"""SQLAlchemy models aligned with FreshSource's shared Supabase schema."""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from .database import Base
except ImportError:
    from database import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def uuid_string() -> str:
    return str(uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=uuid_string)
    auth_id: Mapped[Optional[str]] = mapped_column(Uuid(as_uuid=False), unique=True, nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(32), unique=True, nullable=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    role: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    region: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    listings: Mapped[list["Listing"]] = relationship(back_populates="farmer")
    orders: Mapped[list["Order"]] = relationship(back_populates="buyer")


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=uuid_string)
    farmer_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("users.id"), index=True)
    crop_type: Mapped[str] = mapped_column(String(120), index=True)
    unit: Mapped[str] = mapped_column(String(24), default="bags")
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    price_per_unit: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    location: Mapped[str] = mapped_column(String(120), index=True)
    freshness: Mapped[Optional[str]] = mapped_column(String(48), nullable=True)
    image_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    expected_harvest_date: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    farmer: Mapped[User] = relationship(back_populates="listings")
    orders: Mapped[list["Order"]] = relationship(back_populates="listing")


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=uuid_string)
    listing_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("listings.id"), index=True)
    buyer_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), ForeignKey("users.id"), index=True)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String(32), default="pending", index=True)
    payment_status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)

    buyer: Mapped[User] = relationship(back_populates="orders")
    listing: Mapped[Listing] = relationship(back_populates="orders")


class InboundMessage(Base):
    __tablename__ = "inbound_messages"

    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    sender: Mapped[str] = mapped_column(String(64), nullable=False)
    body: Mapped[str] = mapped_column(String(4096), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="queued", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    body: Mapped[str] = mapped_column(String(4000))
    status: Mapped[str] = mapped_column(String(32), default="queued", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now, index=True)
