import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:telegram_migrator_mobile/features/jobs/domain/entities/migration_job.dart';
import 'package:telegram_migrator_mobile/features/jobs/domain/usecases/control_job_usecase.dart';
import 'package:telegram_migrator_mobile/features/jobs/domain/usecases/create_migration_job_usecase.dart';
import 'package:telegram_migrator_mobile/features/jobs/domain/usecases/get_jobs_usecase.dart';
import 'package:telegram_migrator_mobile/features/jobs/presentation/bloc/jobs_bloc.dart';
import 'package:telegram_migrator_mobile/features/jobs/presentation/bloc/jobs_event.dart';
import 'package:telegram_migrator_mobile/features/jobs/presentation/bloc/jobs_state.dart';

class MockGetJobsUseCase extends Mock implements GetJobsUseCase {}
class MockControlJobUseCase extends Mock implements ControlJobUseCase {}
class MockCreateMigrationJobUseCase extends Mock implements CreateMigrationJobUseCase {}

void main() {
  late MockGetJobsUseCase mockGetJobsUseCase;
  late MockControlJobUseCase mockControlJobUseCase;
  late MockCreateMigrationJobUseCase mockCreateMigrationJobUseCase;
  late JobsBloc bloc;

  setUp(() {
    mockGetJobsUseCase = MockGetJobsUseCase();
    mockControlJobUseCase = MockControlJobUseCase();
    mockCreateMigrationJobUseCase = MockCreateMigrationJobUseCase();
    bloc = JobsBloc(
      mockGetJobsUseCase,
      mockControlJobUseCase,
      mockCreateMigrationJobUseCase,
    );
  });

  tearDown(() {
    bloc.close();
  });

  const testJobs = [
    MigrationJob(
      id: 'job-123',
      sourceId: 100,
      targetId: 200,
      sourceTitle: 'Canal Origen',
      targetTitle: 'Canal Destino',
      status: 'RUNNING',
      totalVideos: 50,
      processedVideos: 10,
      createdAt: '2026-11-15T12:00:00Z',
    ),
  ];

  test('initial state is JobsInitial', () {
    expect(bloc.state, isA<JobsInitial>());
  });

  test('emits [JobsLoading, JobsLoaded] when LoadJobsEvent succeeds', () async {
    when(() => mockGetJobsUseCase(page: 1, pageSize: 30))
        .thenAnswer((_) async => testJobs);

    final expectedStates = [
      isA<JobsLoading>(),
      isA<JobsLoaded>()
          .having((s) => s.jobs.length, 'length', 1)
          .having((s) => s.runningCount, 'runningCount', 1),
    ];

    expectLater(bloc.stream, emitsInOrder(expectedStates));

    bloc.add(const LoadJobsEvent());
  });

  test('pauses job and refreshes list on PauseJobEvent', () async {
    when(() => mockControlJobUseCase.pause('job-123'))
        .thenAnswer((_) async {});
    when(() => mockGetJobsUseCase(page: 1, pageSize: 30))
        .thenAnswer((_) async => testJobs);

    final expectedStates = [
      isA<JobsLoaded>().having((s) => s.actionMessage, 'actionMessage', 'Trabajo pausado'),
    ];

    expectLater(bloc.stream, emitsInOrder(expectedStates));

    bloc.add(const PauseJobEvent('job-123'));
  });
}
