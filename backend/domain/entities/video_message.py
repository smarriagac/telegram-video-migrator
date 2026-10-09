from dataclasses import dataclass, field


@dataclass
class VideoMessage:
    """Represents a Telegram message containing a video with its MTProto document references."""

    message_id: int
    input_document_id: int
    access_hash: int
    file_reference: bytes
    caption: str = ""
    entities: list[dict] = field(default_factory=list)
