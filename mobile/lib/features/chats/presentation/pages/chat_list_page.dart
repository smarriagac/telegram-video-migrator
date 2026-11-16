import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';
import '../bloc/chat_dialogs_bloc.dart';
import '../bloc/chat_dialogs_event.dart';
import '../bloc/chat_dialogs_state.dart';
import '../widgets/chat_dialog_tile.dart';

class ChatListPage extends StatefulWidget {
  const ChatListPage({super.key});

  @override
  State<ChatListPage> createState() => _ChatListPageState();
}

class _ChatListPageState extends State<ChatListPage> {
  @override
  void initState() {
    super.initState();
    context.read<ChatDialogsBloc>().add(const LoadDialogsEvent());
  }

  @override
  Widget build(BuildContext context) {
    ScreenUtil().adaptDeviceScreenSize(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Telegram Migrator',
          style: TextStyle(
            fontSize: 18.sp,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, size: 20.r, color: AppColors.cyan),
            onPressed: () {
              context.read<ChatDialogsBloc>().add(const RefreshDialogsEvent());
            },
          ),
        ],
      ),
      body: BlocBuilder<ChatDialogsBloc, ChatDialogsState>(
        builder: (context, state) {
          if (state is ChatDialogsLoading) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.cyan),
            );
          }

          if (state is ChatDialogsError) {
            return Center(
              child: Padding(
                padding: ScreenUtil.getPadding(all: 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.error_outline, size: 40.r, color: AppColors.rose),
                    SizedBox(height: 12.h),
                    Text(
                      state.message,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13.sp,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    SizedBox(height: 16.h),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.cyan,
                        foregroundColor: Colors.black,
                        padding: ScreenUtil.getPadding(horizontal: 20, vertical: 10),
                      ),
                      onPressed: () {
                        context.read<ChatDialogsBloc>().add(const LoadDialogsEvent());
                      },
                      child: Text(
                        'Reintentar',
                        style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is ChatDialogsLoaded) {
            if (state.dialogs.isEmpty) {
              return Center(
                child: Text(
                  'No hay conversaciones disponibles',
                  style: TextStyle(
                    fontSize: 14.sp,
                    color: AppColors.textMuted,
                  ),
                ),
              );
            }

            return RefreshIndicator(
              color: AppColors.cyan,
              backgroundColor: AppColors.surface,
              onRefresh: () async {
                context.read<ChatDialogsBloc>().add(const RefreshDialogsEvent());
              },
              child: ListView.builder(
                padding: ScreenUtil.getPadding(vertical: 8),
                itemCount: state.dialogs.length,
                itemBuilder: (context, index) {
                  final dialog = state.dialogs[index];
                  return ChatDialogTile(
                    dialog: dialog,
                    onTap: () {
                      context.push('/chat/${dialog.id}', extra: dialog);
                    },
                  );
                },
              ),
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}
