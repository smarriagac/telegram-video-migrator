import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../di/injection.dart';
import 'scaffold_with_nav_bar.dart';
import '../../features/chats/domain/entities/chat_dialog.dart';
import '../../features/chats/presentation/bloc/chat_dialogs_bloc.dart';
import '../../features/chats/presentation/pages/chat_list_page.dart';
import '../../features/chats/presentation/pages/chat_conversation_page.dart';
import '../../features/jobs/presentation/bloc/jobs_bloc.dart';
import '../../features/jobs/presentation/pages/jobs_page.dart';
import '../../features/channels/presentation/bloc/channels_bloc.dart';
import '../../features/channels/presentation/pages/channels_page.dart';
import '../../features/settings/presentation/pages/settings_page.dart';

final GlobalKey<NavigatorState> _rootNavigatorKey =
    GlobalKey<NavigatorState>(debugLabel: 'root');

final GoRouter appRouter = GoRouter(
  navigatorKey: _rootNavigatorKey,
  initialLocation: '/chats',
  routes: [
    StatefulShellRoute.indexedStack(
      builder: (context, state, navigationShell) {
        return ScaffoldWithNavBar(navigationShell: navigationShell);
      },
      branches: [
        // Branch 1: Chats
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/chats',
              builder: (context, state) => BlocProvider(
                create: (context) => sl<ChatDialogsBloc>(),
                child: const ChatListPage(),
              ),
            ),
          ],
        ),

        // Branch 2: Jobs & Migration Queue
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/jobs',
              builder: (context, state) => BlocProvider(
                create: (context) => sl<JobsBloc>(),
                child: const JobsPage(),
              ),
            ),
          ],
        ),

        // Branch 3: Channels
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/channels',
              builder: (context, state) => BlocProvider(
                create: (context) => sl<ChannelsBloc>(),
                child: const ChannelsPage(),
              ),
            ),
          ],
        ),

        // Branch 4: Settings
        StatefulShellBranch(
          routes: [
            GoRoute(
              path: '/settings',
              builder: (context, state) => const SettingsPage(),
            ),
          ],
        ),
      ],
    ),

    // Full screen chat conversation page
    GoRoute(
      parentNavigatorKey: _rootNavigatorKey,
      path: '/chat/:id',
      builder: (context, state) {
        final id = int.tryParse(state.pathParameters['id'] ?? '0') ?? 0;
        final dialog = state.extra as ChatDialog?;
        return ChatConversationPage(chatId: id, initialDialog: dialog);
      },
    ),
  ],
  errorBuilder: (context, state) => Scaffold(
    body: Center(
      child: Text('Ruta no encontrada: ${state.uri}'),
    ),
  ),
);
