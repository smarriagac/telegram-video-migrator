import '../../domain/entities/managed_channel.dart';

abstract class ChannelsState {
  const ChannelsState();
}

class ChannelsInitial extends ChannelsState {
  const ChannelsInitial();
}

class ChannelsLoading extends ChannelsState {
  const ChannelsLoading();
}

class ChannelsLoaded extends ChannelsState {
  final List<ManagedChannel> channels;

  const ChannelsLoaded(this.channels);

  int get postableCount => channels.where((c) => c.canPost).length;
}

class ChannelsError extends ChannelsState {
  final String message;

  const ChannelsError(this.message);
}
