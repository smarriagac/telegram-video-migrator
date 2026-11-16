import '../entities/migration_job.dart';
import '../repositories/jobs_repository.dart';

class CreateMigrationJobUseCase {
  final JobsRepository _repository;

  CreateMigrationJobUseCase(this._repository);

  Future<MigrationJob> call({
    required int sourceId,
    required int targetId,
    bool isFullMigration = true,
  }) {
    return _repository.createJob(
      sourceId: sourceId,
      targetId: targetId,
      isFullMigration: isFullMigration,
    );
  }
}
