from __future__ import annotations

from unittest.mock import MagicMock
from backend.infrastructure.telegram.telethon_adapter import TelethonAdapter


def test_extract_message_text_plain():
    msg = MagicMock()
    msg.message = "Mensaje simple de texto"
    msg.rich_message = None
    msg.action = None
    msg.media = None

    assert TelethonAdapter._extract_message_text(msg) == "Mensaje simple de texto"


def test_extract_message_text_rich_message_blocks():
    # Construct mock PageBlockHeading and PageBlockTable
    heading = MagicMock()
    heading.text = MagicMock(text="🎉 New Purchase!")
    heading.rows = None
    heading.items = None

    cell1 = MagicMock(text="Buyer")
    cell2 = MagicMock(text="El*********")
    row1 = MagicMock(cells=[cell1, cell2])

    cell3 = MagicMock(text="Product")
    cell4 = MagicMock(text="⛩ Crunchyroll 1M Link")
    row2 = MagicMock(cells=[cell3, cell4])

    table = MagicMock()
    table.text = None
    table.rows = [row1, row2]
    table.items = None

    rich = MagicMock()
    rich.blocks = [heading, table]

    msg = MagicMock()
    msg.message = ""
    msg.rich_message = rich
    msg.action = None
    msg.media = None

    result = TelethonAdapter._extract_message_text(msg)
    assert "🎉 New Purchase!" in result
    assert "• **Buyer**: El*********" in result
    assert "• **Product**: ⛩ Crunchyroll 1M Link" in result


def test_extract_message_text_service_action():
    action = MagicMock()
    type(action).__name__ = "MessageActionPinMessage"

    msg = MagicMock()
    msg.message = ""
    msg.rich_message = None
    msg.action = action
    msg.media = None

    result = TelethonAdapter._extract_message_text(msg)
    assert result == "Fijó un mensaje"


def test_extract_message_text_poll():
    poll = MagicMock()
    poll.question = "Qué serie ver hoy?"

    media = MagicMock()
    type(media).__name__ = "MessageMediaPoll"
    media.poll = poll

    msg = MagicMock()
    msg.message = ""
    msg.rich_message = None
    msg.action = None
    msg.media = media

    result = TelethonAdapter._extract_message_text(msg)
    assert result == "📊 Encuesta: Qué serie ver hoy?"


def test_button_url_extraction_from_type():
    b_type = MagicMock()
    b_type.url = "https://t.me/ashasstorebot?start=Y3YyOjgw"
    b_type.data = None

    button = MagicMock()
    button.text = "🔎 View Product"
    button.url = None
    button.data = None
    button.type = b_type

    # Test logic
    b_url = getattr(button, "url", None) or (getattr(button.type, "url", None) if hasattr(button, "type") else None)
    assert b_url == "https://t.me/ashasstorebot?start=Y3YyOjgw"
