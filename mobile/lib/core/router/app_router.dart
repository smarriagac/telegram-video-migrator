import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../di/injection.dart';
import '../../features/chats/domain/entities/chat_dialog.dart';
import '../../features/chats/presentation/bloc/chat_dialogs_bloc.dart';
import '../../features/chats/presentation/pages/chat_list_page.dart';
import '../../features/chats/presentation/pages/chat_conversation_page.dart';

final GoRouter appRouter = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => BlocProvider(
        create: (context) => sl<ChatDialogsBloc>(),
        child: const ChatListPage(),
      ),
      routes: [
        GoRoute(
          path: 'chat/:id',
          builder: (context, state) {
            final id = int.tryParse(state.pathParameters['id'] ?? '0') ?? 0;
            final dialog = state.extra as ChatDialog?;
            return ChatConversationPage(chatId: id, initialDialog: dialog);
          },
        ),
      ],
    ),
  ],
  errorBuilder: (context, state) => Scaffold(
    body: Center(
      child: Text('Ruta no encontrada: ${state.uri}'),
    ),
  ),
);
