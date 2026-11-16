import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:telegram_migrator_mobile/features/chats/domain/entities/chat_dialog.dart';
import 'package:telegram_migrator_mobile/features/chats/domain/usecases/get_dialogs_usecase.dart';
import 'package:telegram_migrator_mobile/features/chats/presentation/bloc/chat_dialogs_bloc.dart';
import 'package:telegram_migrator_mobile/features/chats/presentation/bloc/chat_dialogs_event.dart';
import 'package:telegram_migrator_mobile/features/chats/presentation/bloc/chat_dialogs_state.dart';

class MockGetDialogsUseCase extends Mock implements GetDialogsUseCase {}

void main() {
  late MockGetDialogsUseCase mockGetDialogsUseCase;
  late ChatDialogsBloc bloc;

  setUp(() {
    mockGetDialogsUseCase = MockGetDialogsUseCase();
    bloc = ChatDialogsBloc(mockGetDialogsUseCase);
  });

  tearDown(() {
    bloc.close();
  });

  const testDialogs = [
    ChatDialog(
      id: 1,
      title: 'Canal Test',
      unreadCount: 0,
      type: 'channel',
      isCreator: true,
      canPost: true,
      lastMessage: 'Hola',
      lastDate: '12:00',
    ),
  ];

  test('initial state is ChatDialogsInitial', () {
    expect(bloc.state, isA<ChatDialogsInitial>());
  });

  test('emits [ChatDialogsLoading, ChatDialogsLoaded] when LoadDialogsEvent succeeds', () async {
    when(() => mockGetDialogsUseCase(limit: 50, offset: 0))
        .thenAnswer((_) async => testDialogs);

    final expectedStates = [
      isA<ChatDialogsLoading>(),
      isA<ChatDialogsLoaded>().having((s) => s.dialogs.length, 'length', 1),
    ];

    expectLater(bloc.stream, emitsInOrder(expectedStates));

    bloc.add(const LoadDialogsEvent());
  });
}
