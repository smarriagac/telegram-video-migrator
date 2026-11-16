import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_jobs_usecase.dart';
import '../../domain/usecases/control_job_usecase.dart';
import '../../domain/usecases/create_migration_job_usecase.dart';
import 'jobs_event.dart';
import 'jobs_state.dart';

class JobsBloc extends Bloc<JobsEvent, JobsState> {
  final GetJobsUseCase _getJobsUseCase;
  final ControlJobUseCase _controlJobUseCase;
  final CreateMigrationJobUseCase _createJobUseCase;

  JobsBloc(
    this._getJobsUseCase,
    this._controlJobUseCase,
    this._createJobUseCase,
  ) : super(const JobsInitial()) {
    on<LoadJobsEvent>(_onLoadJobs);
    on<RefreshJobsEvent>(_onRefreshJobs);
    on<PauseJobEvent>(_onPauseJob);
    on<ResumeJobEvent>(_onResumeJob);
    on<CancelJobEvent>(_onCancelJob);
    on<CreateJobEvent>(_onCreateJob);
  }

  Future<void> _onLoadJobs(LoadJobsEvent event, Emitter<JobsState> emit) async {
    emit(const JobsLoading());
    try {
      final jobs = await _getJobsUseCase(page: event.page, pageSize: event.pageSize);
      emit(JobsLoaded(jobs));
    } catch (e) {
      emit(JobsError('Error al cargar la cola de migración: $e'));
    }
  }

  Future<void> _onRefreshJobs(RefreshJobsEvent event, Emitter<JobsState> emit) async {
    try {
      final jobs = await _getJobsUseCase(page: 1, pageSize: 30);
      emit(JobsLoaded(jobs));
    } catch (e) {
      emit(JobsError('Error al refrescar la cola de migración: $e'));
    }
  }

  Future<void> _onPauseJob(PauseJobEvent event, Emitter<JobsState> emit) async {
    try {
      await _controlJobUseCase.pause(event.jobId);
      final jobs = await _getJobsUseCase(page: 1, pageSize: 30);
      emit(JobsLoaded(jobs, actionMessage: 'Trabajo pausado'));
    } catch (e) {
      emit(JobsError('Error al pausar trabajo: $e'));
    }
  }

  Future<void> _onResumeJob(ResumeJobEvent event, Emitter<JobsState> emit) async {
    try {
      await _controlJobUseCase.resume(event.jobId);
      final jobs = await _getJobsUseCase(page: 1, pageSize: 30);
      emit(JobsLoaded(jobs, actionMessage: 'Trabajo reanudado'));
    } catch (e) {
      emit(JobsError('Error al reanudar trabajo: $e'));
    }
  }

  Future<void> _onCancelJob(CancelJobEvent event, Emitter<JobsState> emit) async {
    try {
      await _controlJobUseCase.cancel(event.jobId);
      final jobs = await _getJobsUseCase(page: 1, pageSize: 30);
      emit(JobsLoaded(jobs, actionMessage: 'Trabajo cancelado'));
    } catch (e) {
      emit(JobsError('Error al cancelar trabajo: $e'));
    }
  }

  Future<void> _onCreateJob(CreateJobEvent event, Emitter<JobsState> emit) async {
    emit(const JobsLoading());
    try {
      await _createJobUseCase(
        sourceId: event.sourceId,
        targetId: event.targetId,
        isFullMigration: event.isFullMigration,
      );
      final jobs = await _getJobsUseCase(page: 1, pageSize: 30);
      emit(JobsLoaded(jobs, actionMessage: 'Nueva migración iniciada con éxito'));
    } catch (e) {
      emit(JobsError('Error al crear migración: $e'));
    }
  }
}
