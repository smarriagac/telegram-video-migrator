import '../entities/chat_dialog.dart';
import '../entities/chat_message.dart';

abstract class ChatRepository {
  Future<List<ChatDialog>> getDialogs({int limit = 50, int offset = 0});
  Future<List<ChatMessage>> getMessages(int chatId, {int limit = 40, int? offsetId, int? addOffset});
  Future<ChatMessage?> getPinnedMessage(int chatId);
  Future<ChatMessage> pinMessage(int chatId, int messageId, {bool notify = false});
  Future<void> unpinMessage(int chatId, int messageId);
}
