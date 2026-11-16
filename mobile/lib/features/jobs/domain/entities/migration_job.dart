class MigrationJob {
  final String id;
  final int sourceId;
  final int targetId;
  final String? sourceTitle;
  final String? targetTitle;
  final String status;
  final int totalVideos;
  final int processedVideos;
  final String createdAt;

  const MigrationJob({
    required this.id,
    required this.sourceId,
    required this.targetId,
    this.sourceTitle,
    this.targetTitle,
    required this.status,
    required this.totalVideos,
    required this.processedVideos,
    required this.createdAt,
  });

  double get progress => totalVideos > 0 ? (processedVideos / totalVideos).clamp(0.0, 1.0) : 0.0;
  int get progressPercent => (progress * 100).toInt();
  bool get isRunning => status.toUpperCase() == 'RUNNING';
  bool get isPaused => status.toUpperCase() == 'PAUSED';
  bool get isPending => status.toUpperCase() == 'PENDING';
  bool get isCompleted => status.toUpperCase() == 'COMPLETED';
  bool get isFailed => status.toUpperCase() == 'FAILED';
}
