abstract class ChatDialogsEvent {
  const ChatDialogsEvent();
}

class LoadDialogsEvent extends ChatDialogsEvent {
  final int limit;
  final int offset;

  const LoadDialogsEvent({this.limit = 50, this.offset = 0});
}

class RefreshDialogsEvent extends ChatDialogsEvent {
  const RefreshDialogsEvent();
}
