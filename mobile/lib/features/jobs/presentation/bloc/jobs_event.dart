abstract class JobsEvent {
  const JobsEvent();
}

class LoadJobsEvent extends JobsEvent {
  final int page;
  final int pageSize;

  const LoadJobsEvent({this.page = 1, this.pageSize = 30});
}

class RefreshJobsEvent extends JobsEvent {
  const RefreshJobsEvent();
}

class PauseJobEvent extends JobsEvent {
  final String jobId;

  const PauseJobEvent(this.jobId);
}

class ResumeJobEvent extends JobsEvent {
  final String jobId;

  const ResumeJobEvent(this.jobId);
}

class CancelJobEvent extends JobsEvent {
  final String jobId;

  const CancelJobEvent(this.jobId);
}

class CreateJobEvent extends JobsEvent {
  final int sourceId;
  final int targetId;
  final bool isFullMigration;

  const CreateJobEvent({
    required this.sourceId,
    required this.targetId,
    this.isFullMigration = true,
  });
}
