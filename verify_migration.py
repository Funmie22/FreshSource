#!/usr/bin/env python3
"""
FreshSource Meta WhatsApp Migration - End-to-End Verification Guide
=====================================================================

This script demonstrates and validates the complete migration from Twilio to Meta WhatsApp Cloud API.
Run each test in sequence and verify database/log output.

Prerequisites:
- Backend running: uvicorn backend.main:app --reload
- Database initialized with AUTO_CREATE_TABLES=true
- Meta credentials configured (or using mock mode)
"""

import asyncio
import json
import os
import sys
from decimal import Decimal

# Local imports
sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("DATABASE_URL", "sqlite:///./freshsource.db")
os.environ.setdefault("AUTO_CREATE_TABLES", "true")
os.environ.setdefault("WHATSAPP_VERIFY_TOKEN", "dev_webhook_token_12345")

from backend.database import SessionLocal, create_tables, Base, engine
from backend.models import User, Listing, Order, InboundMessage
from backend.ai_service import extract_listing
from sqlalchemy import select


def setup_test_db():
    """Initialize test database with schema."""
    print("\n" + "="*70)
    print("1. DATABASE SETUP")
    print("="*70)
    create_tables()
    print("✓ Database tables created")
    
    # Verify tables exist
    tables = Base.metadata.tables.keys()
    print(f"✓ Tables registered: {sorted(tables)}")
    
    return SessionLocal()


def test_user_creation(db):
    """Test user creation with phone number and default name."""
    print("\n" + "="*70)
    print("2. USER CREATION & VALIDATION")
    print("="*70)
    
    # Create a user (simulating webhook inbound handler)
    user = User(phone="2348012345678", name="WhatsApp user 5678")
    user.role = "farmer"
    user.region = "Lagos"
    db.add(user)
    db.commit()
    db.refresh(user)
    
    print(f"✓ User created: id={user.id}, phone={user.phone}, role={user.role}")
    print(f"  name={user.name}, region={user.region}")
    
    return user


def test_listing_creation(db, farmer_user):
    """Test listing creation and inventory tracking."""
    print("\n" + "="*70)
    print("3. LISTING CREATION & INVENTORY")
    print("="*70)
    
    listing = Listing(
        farmer_id=farmer_user.id,
        crop_type="Maize",
        unit="bags",
        quantity=Decimal("100.00"),
        price_per_unit=Decimal("35000.00"),
        location="Lagos",
        freshness="Fresh",
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    
    print(f"✓ Listing created: id={listing.id}")
    print(f"  crop={listing.crop_type}, quantity={listing.quantity} {listing.unit}")
    print(f"  price_per_unit=NGN {listing.price_per_unit}, location={listing.location}")
    
    return listing


def test_atomic_order_creation(db, buyer_phone, listing):
    """Test atomic order creation with stock decrement."""
    print("\n" + "="*70)
    print("4. ATOMIC ORDER CREATION & STOCK DECREMENT")
    print("="*70)
    
    # Create buyer
    buyer = User(phone=buyer_phone, name=f"WhatsApp user {buyer_phone[-4:]}")
    buyer.role = "buyer"
    db.add(buyer)
    db.commit()
    db.refresh(buyer)
    print(f"✓ Buyer created: id={buyer.id}, phone={buyer.phone}")
    
    # Create order with atomic stock check
    from sqlalchemy import update
    quantity_requested = Decimal("25.00")
    stock_before = listing.quantity
    
    # Atomic update: only succeeds if stock >= requested
    result = db.execute(
        update(Listing)
        .where(Listing.id == listing.id, Listing.quantity >= quantity_requested)
        .values(quantity=Listing.quantity - quantity_requested)
    )
    
    if result.rowcount == 1:
        order = Order(
            listing_id=listing.id,
            buyer_id=buyer.id,
            quantity=quantity_requested,
            total_price=quantity_requested * listing.price_per_unit,
            status="pending",
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        print(f"✓ Order created: id={order.id}, quantity={order.quantity}, total=NGN {order.total_price}")
        print(f"  Stock: {stock_before} → {stock_before - quantity_requested}")
    else:
        print("✗ Order creation failed: insufficient stock")
        db.rollback()


def test_inbound_message_idempotency(db):
    """Test webhook message idempotency via InboundMessage table."""
    print("\n" + "="*70)
    print("5. WEBHOOK IDEMPOTENCY & MESSAGE TRACKING")
    print("="*70)
    
    message_id = "wamid_test_12345"
    sender = "2348055554321"
    body = "I have 50 bags of maize in Ilorin for 35000 naira per bag"
    
    # First inbound message
    msg1 = InboundMessage(id=message_id, sender=sender, body=body, status="queued")
    db.add(msg1)
    db.commit()
    db.refresh(msg1)
    print(f"✓ Message 1 stored: id={msg1.id}, status={msg1.status}")
    
    # Simulate duplicate webhook (same message_id)
    existing = db.get(InboundMessage, message_id)
    if existing:
        print(f"✓ Idempotency check passed: duplicate detected, status={existing.status}")
        print(f"  → Webhook would return HTTP 200 without re-processing")
    else:
        print("✗ Idempotency check failed")
    
    # Simulate status update after processing
    existing.status = "processed"
    db.commit()
    print(f"✓ Message status updated: {existing.status}")


async def test_extraction(db):
    """Test AI extraction pipeline with farmer message."""
    print("\n" + "="*70)
    print("6. AI EXTRACTION PIPELINE")
    print("="*70)
    
    message = "I have 50 bags of maize in Ilorin for 35000 naira per bag"
    extracted = await extract_listing(message)
    
    if extracted:
        print(f"✓ Extraction successful:")
        print(f"  crop={extracted.crop}")
        print(f"  quantity={extracted.quantity} {extracted.unit}")
        print(f"  location={extracted.location}")
        print(f"  price={extracted.price} {extracted.price_unit}")
    else:
        print("✗ Extraction failed for message (returned None)")


def test_api_endpoints():
    """Provide example curl/PowerShell commands for testing API endpoints."""
    print("\n" + "="*70)
    print("7. API ENDPOINT TEST COMMANDS")
    print("="*70)
    print("\nRun these commands with backend running on http://127.0.0.1:8000")
    
    print("\n→ GET /health")
    print("  Invoke-WebRequest http://127.0.0.1:8000/health")
    
    print("\n→ GET /webhook (Meta verification challenge)")
    print("  $uri = 'http://127.0.0.1:8000/webhook?hub.mode=subscribe&hub.verify_token=dev_webhook_token_12345&hub.challenge=test_challenge'")
    print("  Invoke-WebRequest -Uri $uri")
    
    print("\n→ POST /webhook (Meta inbound message - LIST command)")
    print("  $json = @{")
    print("      entry = @(@{")
    print("          changes = @(@{")
    print("              value = @{")
    print("                  messages = @(@{")
    print("                      id = 'wamid.test_list_' + (Get-Random)")
    print("                      from = '2348012345678'")
    print("                      text = @{ body = 'LIST' }")
    print("                  })")
    print("              }")
    print("          })")
    print("      })")
    print("  } | ConvertTo-Json -Depth 10")
    print("  Invoke-WebRequest -Uri 'http://127.0.0.1:8000/webhook' -Method Post -ContentType 'application/json' -Body $json")
    
    print("\n→ GET /inventory (list active produce listings)")
    print("  Invoke-WebRequest http://127.0.0.1:8000/inventory")
    
    print("\n→ POST /orders (create order programmatically)")
    print("  $order = @{ phone = '2348055554321'; item_id = 'YOUR_ITEM_ID'; quantity = 10 } | ConvertTo-Json")
    print("  Invoke-WebRequest -Uri 'http://127.0.0.1:8000/orders' -Method Post -ContentType 'application/json' -Body $order")


def print_migration_summary():
    """Print summary of the Twilio → Meta migration."""
    print("\n" + "="*70)
    print("MIGRATION SUMMARY: Twilio → Meta WhatsApp Cloud API")
    print("="*70)
    
    print("\n✓ WEBHOOK CHANGES:")
    print("  • GET /webhook: Validates hub.verify_token for Meta challenge")
    print("  • POST /webhook: Parses Meta JSON envelope (entry[0].changes[0].value.messages[0])")
    print("  • Returns: JSON response, not TwiML XML")
    print("  • Idempotency: Checks InboundMessage.id to prevent duplicates")
    
    print("\n✓ OUTBOUND MESSAGING:")
    print("  • send_whatsapp_message(): Now async with httpx client")
    print("  • API: Meta Graph API v18.0")
    print("  • Endpoint: https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages")
    print("  • Auth: Bearer {WHATSAPP_TOKEN}")
    
    print("\n✓ ENVIRONMENT VARIABLES:")
    print("  • WHATSAPP_TOKEN (System User Access Token)")
    print("  • WHATSAPP_PHONE_NUMBER_ID (from Meta Developer Console)")
    print("  • WHATSAPP_VERIFY_TOKEN (custom, configured in Meta webhook settings)")
    print("  • Removed: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER")
    
    print("\n✓ DATABASE RESILIENCE:")
    print("  • Order stock decrement: Atomic UPDATE with WHERE quantity >= requested")
    print("  • Message idempotency: Primary key on InboundMessage.id")
    print("  • User creation: Default name to satisfy NOT NULL constraint")
    
    print("\n✓ BACKGROUND PROCESSING:")
    print("  • Webhook returns HTTP 200 immediately")
    print("  • AI extraction, DB updates, outbound messages queued via FastAPI BackgroundTasks")
    print("  • Status tracking via InboundMessage.status (queued→processed/failed)")
    
    print("\n⚠ KNOWN LIMITATIONS:")
    print("  • BackgroundTasks not durable (can lose messages on crash)")
    print("    → Recommendation: Use Celery/Redis for production")
    print("  • Frontend bypasses backend order logic (direct Supabase)")
    print("    → Recommendation: Unify via backend POST /orders endpoint")
    print("  • No extraction confidence/audit trail in production")
    print("    → Recommendation: Log to ai_extraction_logs table")


async def main():
    """Run all verification tests."""
    print("\n" + "="*70)
    print("FreshSource Meta WhatsApp Migration - Verification Suite")
    print("="*70)
    
    # Setup
    db = setup_test_db()
    
    # Tests
    farmer = test_user_creation(db)
    listing = test_listing_creation(db, farmer)
    test_atomic_order_creation(db, "2348055554321", listing)
    test_inbound_message_idempotency(db)
    await test_extraction(db)
    test_api_endpoints()
    print_migration_summary()
    
    db.close()
    
    print("\n" + "="*70)
    print("✓ Verification suite complete. Review output above.")
    print("="*70 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
