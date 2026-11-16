import 'package:get_it/get_it.dart';
import '../network/api_client.dart';
import '../../features/chats/data/datasources/chat_remote_datasource.dart';
import '../../features/chats/data/repositories/chat_repository_impl.dart';
import '../../features/chats/domain/repositories/chat_repository.dart';
import '../../features/chats/domain/usecases/get_dialogs_usecase.dart';
import '../../features/chats/domain/usecases/get_messages_usecase.dart';
import '../../features/chats/presentation/bloc/chat_dialogs_bloc.dart';

final sl = GetIt.instance;

Future<void> initDependencies() async {
  // Core
  sl.registerLazySingleton<ApiClient>(() => ApiClient());

  // Data Sources
  sl.registerLazySingleton<ChatRemoteDataSource>(
    () => ChatRemoteDataSourceImpl(sl<ApiClient>()),
  );

  // Repositories
  sl.registerLazySingleton<ChatRepository>(
    () => ChatRepositoryImpl(sl<ChatRemoteDataSource>()),
  );

  // Use Cases
  sl.registerLazySingleton<GetDialogsUseCase>(
    () => GetDialogsUseCase(sl<ChatRepository>()),
  );
  sl.registerLazySingleton<GetMessagesUseCase>(
    () => GetMessagesUseCase(sl<ChatRepository>()),
  );

  // BLoCs
  sl.registerFactory<ChatDialogsBloc>(
    () => ChatDialogsBloc(sl<GetDialogsUseCase>()),
  );
}
