import '../../domain/entities/migration_job.dart';

abstract class JobsState {
  const JobsState();
}

class JobsInitial extends JobsState {
  const JobsInitial();
}

class JobsLoading extends JobsState {
  const JobsLoading();
}

class JobsLoaded extends JobsState {
  final List<MigrationJob> jobs;
  final String? actionMessage;

  const JobsLoaded(this.jobs, {this.actionMessage});

  int get runningCount => jobs.where((j) => j.isRunning).length;
  int get pausedCount => jobs.where((j) => j.isPaused).length;
  int get completedCount => jobs.where((j) => j.isCompleted).length;
  int get pendingCount => jobs.where((j) => j.isPending).length;
}

class JobsError extends JobsState {
  final String message;

  const JobsError(this.message);
}
