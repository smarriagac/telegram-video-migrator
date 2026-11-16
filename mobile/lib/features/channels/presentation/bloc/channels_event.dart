abstract class ChannelsEvent {
  const ChannelsEvent();
}

class LoadChannelsEvent extends ChannelsEvent {
  const LoadChannelsEvent();
}

class RefreshChannelsEvent extends ChannelsEvent {
  const RefreshChannelsEvent();
}
