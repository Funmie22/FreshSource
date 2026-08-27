"""Natural-language produce listing extraction for FreshSource."""

from decimal import Decimal, InvalidOperation
import logging
import os
import re

import httpx
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)


class ListingExtraction(BaseModel):
    """Structured fields extracted from a farmer's WhatsApp message."""

    crop: str = Field(min_length=1, max_length=120)
    quantity: Decimal = Field(gt=0)
    unit: str = Field(default="bags", min_length=1, max_length=24)
    location: str = Field(min_length=1, max_length=120)
    price: Decimal = Field(gt=0)
    price_unit: str = Field(default="per unit", max_length=32)


SYSTEM_PROMPT = """You extract agricultural listings from Nigerian farmer WhatsApp messages.
Return JSON only with these keys: crop, quantity, unit, location, price, price_unit.
Normalize crop and location names but do not invent missing values. Quantity and price must be numbers.
Use the farmer's stated unit; if absent use bags. Use price_unit such as 'per bag', 'per kg', or 'per unit'."""


def _local_extract(message: str) -> ListingExtraction | None:
    """Parse common local-demo phrasing when OPENAI_API_KEY is unavailable."""
    quantity_match = re.search(r"(?P<quantity>\d+(?:\.\d+)?)\s*(?P<unit>bags?|kg|kilograms?|tonnes?|tons?|crates?|units?)?", message, re.IGNORECASE)
    price_match = re.search(r"(?:for|at|priced\s+at|selling\s+at)\s*(?:₦|NGN|N|naira)?\s*(?P<price>[\d,]+(?:\.\d+)?)\s*(?:naira|ngn)?\s*(?:per|/)?\s*(?P<price_unit>bag|kg|kilogram|unit|crate)?", message, re.IGNORECASE)
    location_match = re.search(r"\b(?:in|at|from|near)\s+(?P<location>[A-Za-z][A-Za-z .'-]+?)(?=\s+(?:for|at|priced|selling|and)\b|[,.!?]|$)", message, re.IGNORECASE)
    if not quantity_match or not price_match or not location_match:
        return None

    after_quantity = message[quantity_match.end():]
    crop_after_quantity = re.search(r"\bof\s+(?P<crop>[A-Za-z][A-Za-z -]+?)(?=\s+(?:in|at|for|priced|selling)\b|[,.!?]|$)", after_quantity, re.IGNORECASE)
    if crop_after_quantity:
        crop = crop_after_quantity.group("crop").strip()
    else:
        before_quantity = message[:quantity_match.start()].strip(" ,.-")
        crop = re.sub(r"^(?:i\s+have|we\s+have|selling|available)\s+", "", before_quantity, flags=re.IGNORECASE).strip()
    if not crop:
        return None

    try:
        quantity = Decimal(quantity_match.group("quantity"))
        price = Decimal(price_match.group("price").replace(",", ""))
        return ListingExtraction(
            crop=crop.title(),
            quantity=quantity,
            unit=(quantity_match.group("unit") or "bags").lower(),
            location=location_match.group("location").strip().title(),
            price=price,
            price_unit=f"per {(price_match.group('price_unit') or quantity_match.group('unit') or 'unit').lower()}",
        )
    except (InvalidOperation, ValidationError):
        return None


async def extract_listing(message: str) -> ListingExtraction | None:
    """Extract a listing with OpenAI, Ollama, or the deterministic local parser."""
    api_key = os.getenv("OPENAI_API_KEY")
    if api_key:
        try:
            from openai import AsyncOpenAI

            client = AsyncOpenAI(api_key=api_key)
            response = await client.chat.completions.create(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                temperature=0,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": message},
                ],
            )
            return ListingExtraction.model_validate_json(response.choices[0].message.content or "{}")
        except Exception as exc:
            logger.warning("OpenAI extraction failed: %s", exc)

    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
    if os.getenv("OLLAMA_ENABLED", "true").lower() == "true":
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                response = await client.post(
                    f"{ollama_url}/api/chat",
                    json={
                        "model": os.getenv("OLLAMA_MODEL", "llama3.2:3b"),
                        "stream": False,
                        "format": "json",
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": message},
                        ],
                    },
                )
                response.raise_for_status()
                content = response.json().get("message", {}).get("content", "{}")
                return ListingExtraction.model_validate_json(content)
        except Exception as exc:
            logger.info("Ollama unavailable; using local listing parser: %s", exc)

    return _local_extract(message)
