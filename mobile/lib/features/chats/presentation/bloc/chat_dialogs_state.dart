import '../../domain/entities/chat_dialog.dart';

abstract class ChatDialogsState {
  const ChatDialogsState();
}

class ChatDialogsInitial extends ChatDialogsState {
  const ChatDialogsInitial();
}

class ChatDialogsLoading extends ChatDialogsState {
  const ChatDialogsLoading();
}

class ChatDialogsLoaded extends ChatDialogsState {
  final List<ChatDialog> dialogs;

  const ChatDialogsLoaded(this.dialogs);
}

class ChatDialogsError extends ChatDialogsState {
  final String message;

  const ChatDialogsError(this.message);
}
