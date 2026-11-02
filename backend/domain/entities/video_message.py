from dataclasses import dataclass, field


@dataclass
class VideoMessage:
    """Represents a Telegram message (video, photo, document, or text) with MTProto references."""

    message_id: int
    input_document_id: int = 0
    access_hash: int = 0
    file_reference: bytes = b""
    caption: str = ""
    entities: list[dict] = field(default_factory=list)
    source_channel_id: int | None = None
    media_type: str = "video"  # "video", "photo", "document", "text"
    duration: int = 0
    width: int = 0
    height: int = 0
    file_size: int = 0
