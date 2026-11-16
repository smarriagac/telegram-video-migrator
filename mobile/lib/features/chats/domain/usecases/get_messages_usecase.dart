import '../entities/chat_message.dart';
import '../repositories/chat_repository.dart';

class GetMessagesUseCase {
  final ChatRepository _repository;

  GetMessagesUseCase(this._repository);

  Future<List<ChatMessage>> call(int chatId, {int limit = 40, int? offsetId, int? addOffset}) {
    return _repository.getMessages(chatId, limit: limit, offsetId: offsetId, addOffset: addOffset);
  }
}
