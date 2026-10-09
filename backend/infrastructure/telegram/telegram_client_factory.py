from __future__ import annotations

import os
import logging
from dotenv import load_dotenv
from telethon import TelegramClient
from telethon.sessions import StringSession

load_dotenv()
logger = logging.getLogger(__name__)

_client_instance: TelegramClient | None = None
_current_creds: tuple[str, str, str | None] | None = None


def configure_telegram_client(api_id: str, api_hash: str, session_string: str | None = None) -> TelegramClient:
    """Configures or updates singleton TelegramClient from explicit decrypted credentials."""
    global _client_instance, _current_creds
    creds_tuple = (str(api_id), str(api_hash), session_string)
    if _client_instance is not None and _current_creds == creds_tuple:
        return _client_instance

    session = StringSession(session_string or "")
    _client_instance = TelegramClient(session, int(api_id), str(api_hash))
    _current_creds = creds_tuple
    logger.info("TelegramClient successfully configured with active database credentials.")
    return _client_instance


def get_telegram_client() -> TelegramClient:
    """Creates or returns singleton TelegramClient from environment variables."""
    global _client_instance
    if _client_instance is not None:
        return _client_instance

    api_id = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    session_string = os.getenv("TELEGRAM_SESSION_STRING", "")

    if not api_id or not api_hash:
        logger.warning(
            "TELEGRAM_API_ID or TELEGRAM_API_HASH missing. Telegram operations will require configuration in .env or Settings."
        )
        # Fallback dummy credentials to allow server startup in dev/test
        api_id = "12345"
        api_hash = "0123456789abcdef0123456789abcdef"

    session = StringSession(session_string) if session_string else "telegram_migrator.session"
    _client_instance = TelegramClient(session, int(api_id), api_hash)
    return _client_instance
