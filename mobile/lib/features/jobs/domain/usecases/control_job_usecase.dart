import '../repositories/jobs_repository.dart';

class ControlJobUseCase {
  final JobsRepository _repository;

  ControlJobUseCase(this._repository);

  Future<void> pause(String jobId) => _repository.pauseJob(jobId);
  Future<void> resume(String jobId) => _repository.resumeJob(jobId);
  Future<void> cancel(String jobId) => _repository.cancelJob(jobId);
  Future<void> retry(String jobId) => _repository.retryJob(jobId);
  Future<void> delete(String jobId) => _repository.deleteJob(jobId);
}
