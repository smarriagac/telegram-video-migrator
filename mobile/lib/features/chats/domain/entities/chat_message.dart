class ChatMessage {
  final int id;
  final int chatId;
  final String senderName;
  final String text;
  final String date;
  final bool isOutgoing;
  final String? mediaType;
  final bool isRead;

  const ChatMessage({
    required this.id,
    required this.chatId,
    required this.senderName,
    required this.text,
    required this.date,
    required this.isOutgoing,
    this.mediaType,
    required this.isRead,
  });
}
