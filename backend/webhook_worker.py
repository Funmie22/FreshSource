import logging
from sqlalchemy.orm import Session
from backend.database import SessionLocal
from backend.models import InboundMessage
from backend.whatsapp_service import send_whatsapp_message

logger = logging.getLogger(__name__)

def process_inbound_message(message_sid: str, sender: str, body: str) -> None:
    """Background worker for inbound WhatsApp messages."""
    db: Session = SessionLocal()
    try:
        # Business logic execution (Command parsing / AI extraction)
        reply_text = f"Received your message: '{body}'"
        
        # Dispatch outbound response via Twilio API
        send_whatsapp_message(sender, reply_text)

        # Mark message as processed
        msg = db.get(InboundMessage, message_sid)
        if msg:
            msg.status = "processed"
            db.commit()

    except Exception:
        db.rollback()
        logger.exception("Error executing background job for MessageSid: %s", message_sid)
        msg = db.get(InboundMessage, message_sid)
        if msg:
            msg.status = "failed"
            db.commit()
    finally:
        db.close()