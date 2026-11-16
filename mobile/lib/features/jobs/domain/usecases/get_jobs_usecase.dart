import '../entities/migration_job.dart';
import '../repositories/jobs_repository.dart';

class GetJobsUseCase {
  final JobsRepository _repository;

  GetJobsUseCase(this._repository);

  Future<List<MigrationJob>> call({int page = 1, int pageSize = 30}) {
    return _repository.getJobs(page: page, pageSize: pageSize);
  }
}
