"""Pydantic contracts aligned with FreshSource's Supabase tables."""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class InventoryUpsert(BaseModel):
    """Create or update a row in the shared listings table."""

    item_id: Optional[str] = Field(default=None, min_length=1)
    crop_type: str = Field(min_length=1, max_length=120)
    unit: str = Field(default="bags", min_length=1, max_length=24)
    price_per_unit: Decimal = Field(gt=0, decimal_places=2)
    quantity: Decimal = Field(ge=0, decimal_places=2)
    location: str = Field(min_length=1, max_length=120)
    farmer_id: str = Field(min_length=1)
    freshness: Optional[str] = Field(default=None, max_length=48)
    image_url: Optional[str] = Field(default=None, max_length=500)
    expected_harvest_date: Optional[str] = Field(default=None, max_length=32)

    @field_validator("crop_type", "unit", "location", mode="before")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class InventoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    crop_type: str
    unit: str
    price_per_unit: Decimal
    quantity: Decimal
    location: str
    farmer_id: str
    freshness: Optional[str]
    image_url: Optional[str]
    expected_harvest_date: Optional[str]
    farmer_name: Optional[str] = None
    updated_at: datetime


class OrderCreate(BaseModel):
    """Create a pending order against a shared listing."""

    phone: str = Field(min_length=3, max_length=32)
    item_id: str = Field(min_length=1)
    quantity: Decimal = Field(gt=0, decimal_places=2)


class OrderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    listing_id: str
    buyer_id: str
    quantity: Decimal
    total_price: Decimal
    status: str
    payment_status: str
    created_at: datetime


class WebhookMessage(BaseModel):
    """Normalized inbound WhatsApp message."""

    sender: str = Field(min_length=3, max_length=64)
    body: str = Field(default="", max_length=4096)
