#!/usr/bin/env python3
"""Test AI extraction pipeline with various messages."""
import asyncio
import os
os.environ["DATABASE_URL"] = "sqlite:///./test-startup.db"

from backend.ai_service import extract_listing

test_messages = [
    "I have 50 bags of maize in Ilorin for 35000 naira per bag",
    "200 kg of tomatoes in Lagos, 2500 per kg",
    "Selling 10 crates of oranges in Ibadan for 5000 per crate",
    "Random text without structure",
    "",
]

async def test():
    print("Testing extraction pipeline...")
    for msg in test_messages:
        try:
            result = await extract_listing(msg)
            status = "✓" if result else "✗"
            details = f"crop={result.crop}, qty={result.quantity}, location={result.location}" if result else "None"
            print(f"{status} '{msg[:45]:45}' -> {details}")
        except Exception as e:
            print(f"✗ '{msg[:45]:45}' -> ERROR: {str(e)[:50]}")

if __name__ == "__main__":
    asyncio.run(test())
