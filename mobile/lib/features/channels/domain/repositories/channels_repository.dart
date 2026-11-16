import '../entities/managed_channel.dart';

abstract class ChannelsRepository {
  Future<List<ManagedChannel>> getChannels();
}
