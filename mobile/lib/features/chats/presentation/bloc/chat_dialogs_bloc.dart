import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_dialogs_usecase.dart';
import 'chat_dialogs_event.dart';
import 'chat_dialogs_state.dart';

class ChatDialogsBloc extends Bloc<ChatDialogsEvent, ChatDialogsState> {
  final GetDialogsUseCase _getDialogsUseCase;

  ChatDialogsBloc(this._getDialogsUseCase) : super(const ChatDialogsInitial()) {
    on<LoadDialogsEvent>(_onLoadDialogs);
    on<RefreshDialogsEvent>(_onRefreshDialogs);
  }

  Future<void> _onLoadDialogs(
    LoadDialogsEvent event,
    Emitter<ChatDialogsState> emit,
  ) async {
    emit(const ChatDialogsLoading());
    try {
      final dialogs = await _getDialogsUseCase(limit: event.limit, offset: event.offset);
      emit(ChatDialogsLoaded(dialogs));
    } catch (e) {
      emit(ChatDialogsError('Error al cargar conversaciones: $e'));
    }
  }

  Future<void> _onRefreshDialogs(
    RefreshDialogsEvent event,
    Emitter<ChatDialogsState> emit,
  ) async {
    try {
      final dialogs = await _getDialogsUseCase(limit: 50, offset: 0);
      emit(ChatDialogsLoaded(dialogs));
    } catch (e) {
      emit(ChatDialogsError('Error al actualizar conversaciones: $e'));
    }
  }
}
