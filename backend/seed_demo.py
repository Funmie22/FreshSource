"""Seed a small FreshSource dataset for a live product demonstration."""

from decimal import Decimal

from sqlalchemy import delete

from .database import SessionLocal, create_tables
from .models import Listing, Order, User


def seed_demo() -> None:
    """Reset the local database and create farmer/buyer demo records."""
    create_tables()
    db = SessionLocal()
    try:
        db.execute(delete(Order))
        db.execute(delete(Listing))
        db.execute(delete(User))
        farmer = User(phone="whatsapp:+2348012345678", name="Amina Farmer", role="farmer", region="Ilorin")
        buyer = User(phone="whatsapp:+2348098765432", name="Lagos Buyer", role="buyer", region="Ilorin")
        db.add_all([farmer, buyer])
        db.flush()
        db.add_all(
            [
                Listing(crop_type="Tomatoes", unit="bags", price_per_unit=Decimal("28000"), quantity=25, location="Ilorin", farmer_id=farmer.id),
                Listing(crop_type="Cassava", unit="bags", price_per_unit=Decimal("18000"), quantity=80, location="Ibadan", farmer_id=farmer.id),
            ]
        )
        db.commit()
        print("Demo data seeded: 1 farmer, 1 buyer, 2 produce listings.")
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo()
