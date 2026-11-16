class ChatDialog {
  final int id;
  final String title;
  final String? username;
  final int unreadCount;
  final String type;
  final bool isCreator;
  final bool canPost;
  final String? lastMessage;
  final String? lastDate;
  final String? avatarColor;

  const ChatDialog({
    required this.id,
    required this.title,
    this.username,
    required this.unreadCount,
    required this.type,
    required this.isCreator,
    required this.canPost,
    this.lastMessage,
    this.lastDate,
    this.avatarColor,
  });
}
