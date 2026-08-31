from contextlib import asynccontextmanager
from decimal import Decimal
import logging
import os
import re
from typing import Any

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Query,
    Request,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy import update, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.ai_service import ListingExtraction, extract_listing
from backend.database import SessionLocal, create_tables, get_db
from backend.models import InboundMessage, Listing, Order, User, utc_now
from backend.schemas import InventoryRead, InventoryUpsert, OrderCreate, OrderRead
from backend.whatsapp_service import send_whatsapp_message

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("freshsource.api")

VERIFY_TOKEN = os.getenv("WHATSAPP_VERIFY_TOKEN", "")
ORDER_PATTERN = re.compile(
    r"^ORDER\s+(?P<item_id>[0-9a-f-]{36})\s+(?P<quantity>\d+(?:\.\d+)?)$",
    re.IGNORECASE,
)
MENU_MESSAGE = (
    "Welcome to FreshSource. Reply with:\n"
    "LIST - browse available produce\n"
    "ORDER <item_id> <quantity> - place an order\n"
    "STATUS - check your recent orders"
)
LISTING_HELP = (
    "I couldn't identify the listing. Please include the crop, quantity,"
    " location, and price. Example: I have 50 bags of maize in Ilorin for 35000"
    " naira per bag."
)


@asynccontextmanager
async def lifespan(_: FastAPI):
  if os.getenv("AUTO_CREATE_TABLES", "false").lower() == "true":
    create_tables()
  logger.info("FreshSource API started")
  yield
  logger.info("FreshSource API stopped")


app = FastAPI(title="FreshSource API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)


def require_inventory_key(x_api_key: str | None = Header(default=None)) -> None:
  expected = os.getenv("INVENTORY_API_KEY")
  if expected and x_api_key != expected:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid inventory API key",
    )


def get_or_create_user(db: Session, phone: str) -> User:
  user = db.scalar(select(User).where(User.phone == phone))
  if user:
    return user
  user = User(phone=phone, name=f"WhatsApp user {phone[-4:]}")
  db.add(user)
  db.commit()
  db.refresh(user)
  return user


def create_listing(
    db: Session, phone: str, listing: ListingExtraction
) -> Listing:
  farmer = get_or_create_user(db, phone)
  farmer.role = "farmer"
  farmer.region = listing.location
  item = Listing(
      crop_type=listing.crop,
      unit=listing.unit,
      price_per_unit=listing.price,
      quantity=listing.quantity,
      location=listing.location,
      farmer_id=farmer.id,
  )
  db.add(item)
  db.commit()
  db.refresh(item)
  return item


def matching_buyers(db: Session, location: str, farmer_phone: str) -> list[User]:
  buyers = list(
      db.scalars(
          select(User).where(User.role == "buyer", User.phone != farmer_phone)
      )
  )
  location_lower = location.lower()
  return [
      buyer
      for buyer in buyers
      if buyer.region
      and (
          buyer.region.lower() in location_lower
          or location_lower in buyer.region.lower()
      )
  ]


async def send_buyer_alerts(db: Session, item: Listing, farmer_phone: str) -> int:
  buyers = matching_buyers(db, item.location or "", farmer_phone)
  message = f"FreshSource alert: {item.quantity} {item.unit} of {item.crop_type} is available in {item.location} at NGN {item.price_per_unit}/{item.unit}."
  for buyer in buyers:
    try:
      await send_whatsapp_message(buyer.phone, message)
    except Exception:
      logger.exception("Failed to alert buyer %s", buyer.id)
  return len(buyers)


def format_inventory(items: list[Listing]) -> str:
  if not items:
    return "No produce is currently available. Please check again soon."
  lines = ["Available produce:"]
  for item in items:
    lines.append(
        f"#{item.id} {item.crop_type} - NGN {item.price_per_unit}/{item.unit},"
        f" {item.quantity}{item.unit} left"
    )
  return "\n".join(lines)


def format_orders(orders: list[Order]) -> str:
  if not orders:
    return "You have no orders yet."
  lines = ["Your recent orders:"]
  for order in orders:
    lines.append(
        f"#{order.id} - {order.listing.crop_type},"
        f" {order.quantity}{order.listing.unit}, NGN {order.total_price}"
        f" ({order.status})"
    )
  return "\n".join(lines)


def create_order(
    db: Session, phone: str, item_id: str, quantity: Decimal
) -> Order:
  if quantity <= 0:
    raise HTTPException(
        status_code=422, detail="Quantity must be greater than zero"
    )

  user = get_or_create_user(db, phone)
  if user.role is None:
    user.role = "buyer"
  item = db.get(Listing, item_id)
  if not item:
    raise HTTPException(status_code=404, detail="Inventory item not found")
  stock_update = db.execute(
      update(Listing)
      .where(Listing.id == item_id, Listing.quantity >= quantity)
      .values(quantity=Listing.quantity - quantity, updated_at=utc_now())
  )
  if stock_update.rowcount != 1:
    db.rollback()
    available = db.scalar(select(Listing.quantity).where(Listing.id == item_id))
    if available is None:
      raise HTTPException(status_code=404, detail="Inventory item not found")
    raise HTTPException(status_code=409, detail=f"Only {available}{item.unit} is available")

  order = Order(
      listing_id=item.id,
      buyer_id=user.id,
      total_price=quantity * item.price_per_unit,
      quantity=quantity,
      status="pending",
  )
  db.add(order)
  db.commit()
  db.refresh(order)
  return order


async def process_inbound_message_background(
    message_sid: str, phone: str, command: str
) -> None:
  """Execute AI extraction, DB updates, and outbound WhatsApp replies asynchronously."""
  db: Session = SessionLocal()
  normalized = command.upper()
  try:
    if normalized == "LIST":
      items = list(
          db.scalars(
              select(Listing)
              .where(Listing.quantity > 0)
              .order_by(Listing.crop_type)
          )
      )
      reply = format_inventory(items)
    elif normalized == "STATUS":
      user = db.scalar(select(User).where(User.phone == phone))
      orders = (
          list(
              db.scalars(
                  select(Order)
                  .where(Order.buyer_id == user.id)
                  .order_by(Order.created_at.desc())
                  .limit(5)
              )
          )
          if user
          else []
      )
      reply = format_orders(orders)
    else:
      match = ORDER_PATTERN.match(command)
      if match:
        order = create_order(
            db, phone, match.group("item_id"), Decimal(match.group("quantity"))
        )
        reply = (
            f"Order #{order.id} created. Total: NGN {order.total_price}."
            " Status: pending."
        )
      else:
        extracted = await extract_listing(command)
        if extracted:
          item = create_listing(db, phone, extracted)
          buyer_count = await send_buyer_alerts(db, item, phone)
          reply = (
              f"Your listing is live: {item.quantity} {item.unit} of"
              f" {item.crop_type} in {item.location} at NGN"
              f" {item.price_per_unit}/{item.unit}. {buyer_count} nearby"
              " buyer(s) were alerted."
          )
        else:
          reply = f"{LISTING_HELP}\n\n{MENU_MESSAGE}"

    await send_whatsapp_message(phone, reply)

    msg = db.get(InboundMessage, message_sid)
    if msg:
      msg.status = "processed"
      db.commit()
  except HTTPException as exc:
    db.rollback()
    await send_whatsapp_message(
        phone, f"Unable to complete that request: {exc.detail}"
    )
    msg = db.get(InboundMessage, message_sid)
    if msg:
      msg.status = "failed"
      db.commit()
  except (IntegrityError, ValueError) as exc:
    db.rollback()
    logger.warning("Webhook command processing failed: %s", exc)
    await send_whatsapp_message(
        phone,
        "That order could not be processed. Check the item ID and quantity,"
        " then try again.",
    )
    msg = db.get(InboundMessage, message_sid)
    if msg:
      msg.status = "failed"
      db.commit()
  except Exception as exc:
    db.rollback()
    logger.exception(
        "Unexpected exception during background processing for %s: %s",
        message_sid,
        exc,
    )
    await send_whatsapp_message(
        phone,
        "Sorry, an unexpected error occurred while processing your request.",
    )
    msg = db.get(InboundMessage, message_sid)
    if msg:
      msg.status = "failed"
      db.commit()
  finally:
    db.close()


@app.get("/health")
def health() -> dict[str, str]:
  return {"status": "ok"}


@app.get("/inventory", response_model=list[InventoryRead])
def list_inventory(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
  rows = db.execute(
      select(Listing, User.name.label("farmer_name"))
      .outerjoin(User, User.id == Listing.farmer_id)
      .where(Listing.quantity > 0)
      .order_by(Listing.crop_type)
  ).all()
  return [
      {
          "id": listing.id,
          "crop_type": listing.crop_type,
          "unit": listing.unit,
          "price_per_unit": listing.price_per_unit,
          "quantity": listing.quantity,
          "location": listing.location,
          "farmer_id": listing.farmer_id,
          "freshness": listing.freshness,
          "image_url": listing.image_url,
          "expected_harvest_date": listing.expected_harvest_date,
          "farmer_name": farmer_name,
          "updated_at": listing.updated_at,
      }
      for listing, farmer_name in rows
  ]


@app.post(
    "/inventory",
    response_model=InventoryRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_inventory_key)],
)
def upsert_inventory(
    payload: InventoryUpsert, db: Session = Depends(get_db)
) -> Listing:
  item = db.get(Listing, payload.item_id) if payload.item_id else None
  if item:
    item.crop_type = payload.crop_type
    item.unit = payload.unit
    item.price_per_unit = payload.price_per_unit
    item.quantity = payload.quantity
    item.location = payload.location
    item.farmer_id = payload.farmer_id
    item.updated_at = utc_now()
  else:
    item = Listing(**payload.model_dump(exclude={"item_id"}))
    db.add(item)
  db.commit()
  db.refresh(item)
  return item


@app.post(
    "/orders", response_model=OrderRead, status_code=status.HTTP_201_CREATED
)
def create_programmatic_order(
    payload: OrderCreate, db: Session = Depends(get_db)
) -> Order:
  return create_order(db, payload.phone, payload.item_id, payload.quantity)


@app.get("/webhook")
async def verify_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
  if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
    return PlainTextResponse(content=hub_challenge, status_code=200)

  raise HTTPException(
      status_code=status.HTTP_403_FORBIDDEN,
      detail="Verification token mismatch",
  )


@app.post("/webhook")
async def whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> JSONResponse:
  data = await request.json()
  value = data.get("entry", [{}])[0].get("changes", [{}])[0].get("value", {})
  messages = value.get("messages") or []
  if not messages:
    return JSONResponse(content={"status": "acknowledged"}, status_code=200)

  msg_data = messages[0]
  message_sid = str(msg_data.get("id", "")).strip()
  phone = str(msg_data.get("from", "")).strip()
  command = str(msg_data.get("text", {}).get("body", "")).strip()
  if not message_sid or not phone or not command:
    return JSONResponse(content={"status": "acknowledged"}, status_code=200)

  if db.get(InboundMessage, message_sid):
    return JSONResponse(content={"status": "received"}, status_code=200)

  try:
    db.add(InboundMessage(id=message_sid, sender=phone, body=command, status="queued"))
    db.commit()
  except IntegrityError:
    db.rollback()
    return JSONResponse(content={"status": "received"}, status_code=200)

  background_tasks.add_task(process_inbound_message_background, message_sid, phone, command)
  return JSONResponse(content={"status": "received"}, status_code=200)


@app.api_route("/", methods=["GET", "HEAD"])
def root() -> dict[str, Any]:
  return {"service": "FreshSource API", "docs": "/docs", "webhook": "/webhook"}