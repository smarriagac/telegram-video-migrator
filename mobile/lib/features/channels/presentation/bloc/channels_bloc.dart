import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/usecases/get_channels_usecase.dart';
import 'channels_event.dart';
import 'channels_state.dart';

class ChannelsBloc extends Bloc<ChannelsEvent, ChannelsState> {
  final GetChannelsUseCase _getChannelsUseCase;

  ChannelsBloc(this._getChannelsUseCase) : super(const ChannelsInitial()) {
    on<LoadChannelsEvent>(_onLoadChannels);
    on<RefreshChannelsEvent>(_onRefreshChannels);
  }

  Future<void> _onLoadChannels(
    LoadChannelsEvent event,
    Emitter<ChannelsState> emit,
  ) async {
    emit(const ChannelsLoading());
    try {
      final channels = await _getChannelsUseCase();
      emit(ChannelsLoaded(channels));
    } catch (e) {
      emit(ChannelsError(e.toString()));
    }
  }

  Future<void> _onRefreshChannels(
    RefreshChannelsEvent event,
    Emitter<ChannelsState> emit,
  ) async {
    try {
      final channels = await _getChannelsUseCase();
      emit(ChannelsLoaded(channels));
    } catch (e) {
      emit(ChannelsError(e.toString()));
    }
  }
}
