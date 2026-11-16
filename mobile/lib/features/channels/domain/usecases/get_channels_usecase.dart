import '../entities/managed_channel.dart';
import '../repositories/channels_repository.dart';

class GetChannelsUseCase {
  final ChannelsRepository _repository;

  GetChannelsUseCase(this._repository);

  Future<List<ManagedChannel>> call() {
    return _repository.getChannels();
  }
}
