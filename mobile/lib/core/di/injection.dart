import 'package:get_it/get_it.dart';
import '../network/api_client.dart';
import '../../features/chats/data/datasources/chat_remote_datasource.dart';
import '../../features/chats/data/repositories/chat_repository_impl.dart';
import '../../features/chats/domain/repositories/chat_repository.dart';
import '../../features/chats/domain/usecases/get_dialogs_usecase.dart';
import '../../features/chats/domain/usecases/get_messages_usecase.dart';
import '../../features/chats/presentation/bloc/chat_dialogs_bloc.dart';
import '../../features/jobs/data/datasources/jobs_remote_datasource.dart';
import '../../features/jobs/data/repositories/jobs_repository_impl.dart';
import '../../features/jobs/domain/repositories/jobs_repository.dart';
import '../../features/jobs/domain/usecases/get_jobs_usecase.dart';
import '../../features/jobs/domain/usecases/control_job_usecase.dart';
import '../../features/jobs/domain/usecases/create_migration_job_usecase.dart';
import '../../features/jobs/presentation/bloc/jobs_bloc.dart';
import '../../features/channels/data/datasources/channels_remote_datasource.dart';
import '../../features/channels/data/repositories/channels_repository_impl.dart';
import '../../features/channels/domain/repositories/channels_repository.dart';
import '../../features/channels/domain/usecases/get_channels_usecase.dart';
import '../../features/channels/presentation/bloc/channels_bloc.dart';

final sl = GetIt.instance;

Future<void> initDependencies() async {
  // Core
  sl.registerLazySingleton<ApiClient>(() => ApiClient());

  // Chats Data Sources & Repositories
  sl.registerLazySingleton<ChatRemoteDataSource>(
    () => ChatRemoteDataSourceImpl(sl<ApiClient>()),
  );
  sl.registerLazySingleton<ChatRepository>(
    () => ChatRepositoryImpl(sl<ChatRemoteDataSource>()),
  );

  // Chats Use Cases
  sl.registerLazySingleton<GetDialogsUseCase>(
    () => GetDialogsUseCase(sl<ChatRepository>()),
  );
  sl.registerLazySingleton<GetMessagesUseCase>(
    () => GetMessagesUseCase(sl<ChatRepository>()),
  );

  // Chats BLoCs
  sl.registerFactory<ChatDialogsBloc>(
    () => ChatDialogsBloc(sl<GetDialogsUseCase>()),
  );

  // Jobs Data Sources & Repositories
  sl.registerLazySingleton<JobsRemoteDataSource>(
    () => JobsRemoteDataSourceImpl(sl<ApiClient>()),
  );
  sl.registerLazySingleton<JobsRepository>(
    () => JobsRepositoryImpl(sl<JobsRemoteDataSource>()),
  );

  // Jobs Use Cases
  sl.registerLazySingleton<GetJobsUseCase>(
    () => GetJobsUseCase(sl<JobsRepository>()),
  );
  sl.registerLazySingleton<ControlJobUseCase>(
    () => ControlJobUseCase(sl<JobsRepository>()),
  );
  sl.registerLazySingleton<CreateMigrationJobUseCase>(
    () => CreateMigrationJobUseCase(sl<JobsRepository>()),
  );

  // Jobs BLoCs
  sl.registerFactory<JobsBloc>(
    () => JobsBloc(
      sl<GetJobsUseCase>(),
      sl<ControlJobUseCase>(),
      sl<CreateMigrationJobUseCase>(),
    ),
  );

  // Channels Data Sources & Repositories
  sl.registerLazySingleton<ChannelsRemoteDataSource>(
    () => ChannelsRemoteDataSourceImpl(sl<ApiClient>()),
  );
  sl.registerLazySingleton<ChannelsRepository>(
    () => ChannelsRepositoryImpl(sl<ChannelsRemoteDataSource>()),
  );

  // Channels Use Cases
  sl.registerLazySingleton<GetChannelsUseCase>(
    () => GetChannelsUseCase(sl<ChannelsRepository>()),
  );

  // Channels BLoCs
  sl.registerFactory<ChannelsBloc>(
    () => ChannelsBloc(sl<GetChannelsUseCase>()),
  );
}
