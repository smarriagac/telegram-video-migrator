class ManagedChannel {
  final int id;
  final String title;
  final String? username;
  final bool canPost;
  final int? accountId;
  final String? accountName;
  final String type;

  const ManagedChannel({
    required this.id,
    required this.title,
    this.username,
    required this.canPost,
    this.accountId,
    this.accountName,
    required this.type,
  });
}
