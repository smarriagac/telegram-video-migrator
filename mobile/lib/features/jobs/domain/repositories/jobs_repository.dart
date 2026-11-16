import '../entities/migration_job.dart';

abstract class JobsRepository {
  Future<List<MigrationJob>> getJobs({int page = 1, int pageSize = 30});
  Future<void> pauseJob(String jobId);
  Future<void> resumeJob(String jobId);
  Future<void> cancelJob(String jobId);
  Future<void> retryJob(String jobId);
  Future<void> deleteJob(String jobId);
  Future<MigrationJob> createJob({
    required int sourceId,
    required int targetId,
    bool isFullMigration = true,
  });
}
