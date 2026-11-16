import '../entities/chat_dialog.dart';
import '../repositories/chat_repository.dart';

class GetDialogsUseCase {
  final ChatRepository _repository;

  GetDialogsUseCase(this._repository);

  Future<List<ChatDialog>> call({int limit = 50, int offset = 0}) {
    return _repository.getDialogs(limit: limit, offset: offset);
  }
}
