import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/network/api_client.dart';
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

  void _showServerSettingsDialog() {
    final apiClient = sl<ApiClient>();
    final controller = TextEditingController(text: apiClient.baseUrl);

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16.r),
          side: BorderSide(color: AppColors.cardBorder, width: 1.w),
        ),
        title: Text(
          'Servidor Backend',
          style: TextStyle(
            fontSize: 16.sp,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Dirección IP del servidor FastAPI:',
              style: TextStyle(fontSize: 12.sp, color: AppColors.textSecondary),
            ),
            SizedBox(height: 10.h),
            TextField(
              controller: controller,
              style: TextStyle(fontSize: 13.sp, color: AppColors.textPrimary),
              decoration: InputDecoration(
                hintText: 'http://192.168.1.35:7901',
                hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 12.sp),
                filled: true,
                fillColor: AppColors.card,
                contentPadding: ScreenUtil.getPadding(horizontal: 12, vertical: 10),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8.r),
                  borderSide: BorderSide(color: AppColors.cardBorder, width: 1.w),
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(
              'Cancelar',
              style: TextStyle(fontSize: 13.sp, color: AppColors.textMuted),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.cyan,
              foregroundColor: Colors.black,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8.r)),
            ),
            onPressed: () {
              final newUrl = controller.text.trim();
              if (newUrl.isNotEmpty) {
                apiClient.setBaseUrl(newUrl);
                Navigator.of(ctx).pop();
                context.read<ChatDialogsBloc>().add(const LoadDialogsEvent());
              }
            },
            child: Text(
              'Guardar y Conectar',
              style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
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
            icon: Icon(Icons.dns_outlined, size: 20.r, color: AppColors.textSecondary),
            tooltip: 'Configurar servidor',
            onPressed: _showServerSettingsDialog,
          ),
          IconButton(
            icon: Icon(Icons.refresh, size: 20.r, color: AppColors.cyan),
            tooltip: 'Actualizar',
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
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: AppColors.cardBorder),
                            padding: ScreenUtil.getPadding(horizontal: 16, vertical: 10),
                          ),
                          onPressed: _showServerSettingsDialog,
                          child: Text(
                            'Configurar Servidor',
                            style: TextStyle(fontSize: 13.sp, color: AppColors.cyan),
                          ),
                        ),
                        SizedBox(width: 12.w),
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
