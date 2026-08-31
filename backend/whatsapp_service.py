# """WhatsApp transport helpers.

# The webhook returns TwiML directly for Twilio WhatsApp webhooks. ``send_whatsapp_message``
# is provided for flows that need an outbound API call instead of a webhook response.
# """

# import logging
# import os
# from typing import Any
# from xml.sax.saxutils import escape

# import httpx
# from twilio.rest import Client
# from twilio.request_validator import RequestValidator

# logger = logging.getLogger(__name__)


# def twilio_whatsapp_number(value: str) -> str:
#     """Ensure a phone number uses Twilio's WhatsApp address format."""
#     return value if value.startswith("whatsapp:") else f"whatsapp:{value}"


# def validate_twilio_signature(url: str, params: dict[str, str], signature: str | None) -> bool:
#     """Validate a Twilio webhook signature when validation is enabled."""
#     auth_token = os.getenv("TWILIO_AUTH_TOKEN")
#     if os.getenv("TWILIO_VALIDATE_SIGNATURE", "false").lower() != "true":
#         return True
#     if not auth_token or not signature:
#         return False
#     return RequestValidator(auth_token).validate(url, params, signature)


# def twiml_reply(message: str) -> str:
#     """Build a Twilio-compatible XML response for an inbound WhatsApp message."""
#     return f'<?xml version="1.0" encoding="UTF-8"?><Response><Message>{escape(message)}</Message></Response>'


# def send_whatsapp_message(to: str, message: str) -> dict[str, Any]:
#     """Send a WhatsApp reply through Twilio when credentials are configured.

#     In local development without credentials, this logs the outbound message and returns
#     a mock response, allowing command handling to be tested without an external API call.
#     """
#     account_sid = os.getenv("TWILIO_ACCOUNT_SID")
#     auth_token = os.getenv("TWILIO_AUTH_TOKEN")
#     twilio_number = os.getenv("TWILIO_NUMBER")

#     if not all((account_sid, auth_token, twilio_number)):
#         logger.info("Mock WhatsApp message to %s: %s", to, message)
#         return {"mock": True, "to": to, "message": message}

#     client = Client(account_sid, auth_token)
#     sent = client.messages.create(
#         body=message,
#         from_=twilio_whatsapp_number(twilio_number),
#         to=twilio_whatsapp_number(to),
#     )
#     return {"mock": False, "sid": sent.sid, "status": sent.status}


# async def send_whatsapp_business_message(to: str, message: str) -> dict[str, Any]:
#     """Optional Meta WhatsApp Cloud API helper for deployments using Meta directly."""
#     token = os.getenv("WHATSAPP_ACCESS_TOKEN")
#     phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
#     if not token or not phone_number_id:
#         return send_whatsapp_message(to, message)

#     url = f"https://graph.facebook.com/v21.0/{phone_number_id}/messages"
#     payload = {
#         "messaging_product": "whatsapp",
#         "to": to.removeprefix("whatsapp:"),
#         "type": "text",
#         "text": {"body": message},
#     }
#     async with httpx.AsyncClient(timeout=10) as client:
#         response = await client.post(url, headers={"Authorization": f"Bearer {token}"}, json=payload)
#         response.raise_for_status()
#         return response.json()

"""Meta WhatsApp Cloud API transport helpers."""

import logging
import os
from typing import Any

import httpx

logger = logging.getLogger(__name__)


async def send_whatsapp_message(to_phone: str, message_body: str) -> dict[str, Any]:
    """Send a text message through Meta's WhatsApp Cloud API."""
    token = os.getenv("WHATSAPP_TOKEN") or os.getenv("WHATSAPP_ACCESS_TOKEN")
    phone_number_id = os.getenv("WHATSAPP_PHONE_NUMBER_ID")
    if not token or not phone_number_id:
        logger.info("Mock WhatsApp message to %s: %s", to_phone, message_body)
        return {"mock": True, "to": to_phone, "message": message_body}

    url = f"https://graph.facebook.com/v18.0/{phone_number_id}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to_phone.removeprefix("whatsapp:"),
        "type": "text",
        "text": {"body": message_body},
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                url,
                headers={"Authorization": f"Bearer {token}"},
                json=payload,
            )
        if response.is_error:
            logger.error("Meta WhatsApp API returned %s: %s", response.status_code, response.text)
            response.raise_for_status()
        return response.json()
    except httpx.HTTPError:
        logger.exception("Failed to send WhatsApp message to %s via Meta API", to_phone)
        raise