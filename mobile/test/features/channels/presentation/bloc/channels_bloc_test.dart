import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:telegram_migrator_mobile/features/channels/domain/entities/managed_channel.dart';
import 'package:telegram_migrator_mobile/features/channels/domain/usecases/get_channels_usecase.dart';
import 'package:telegram_migrator_mobile/features/channels/presentation/bloc/channels_bloc.dart';
import 'package:telegram_migrator_mobile/features/channels/presentation/bloc/channels_event.dart';
import 'package:telegram_migrator_mobile/features/channels/presentation/bloc/channels_state.dart';

class MockGetChannelsUseCase extends Mock implements GetChannelsUseCase {}

void main() {
  late MockGetChannelsUseCase mockGetChannelsUseCase;
  late ChannelsBloc bloc;

  setUp(() {
    mockGetChannelsUseCase = MockGetChannelsUseCase();
    bloc = ChannelsBloc(mockGetChannelsUseCase);
  });

  tearDown(() {
    bloc.close();
  });

  const testChannels = [
    ManagedChannel(
      id: -1001234567,
      title: 'Canal VIP',
      username: 'vip_channel',
      canPost: true,
      type: 'channel',
      accountName: 'Admin',
    ),
  ];

  test('initial state is ChannelsInitial', () {
    expect(bloc.state, isA<ChannelsInitial>());
  });

  test('emits [ChannelsLoading, ChannelsLoaded] when LoadChannelsEvent succeeds', () async {
    when(() => mockGetChannelsUseCase()).thenAnswer((_) async => testChannels);

    final expectedStates = [
      isA<ChannelsLoading>(),
      isA<ChannelsLoaded>()
          .having((s) => s.channels.length, 'length', 1)
          .having((s) => s.postableCount, 'postableCount', 1),
    ];

    expectLater(bloc.stream, emitsInOrder(expectedStates));

    bloc.add(const LoadChannelsEvent());
  });
}
