import 'package:flutter/material.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';
import '../../domain/entities/chat_dialog.dart';
import '../../domain/entities/chat_message.dart';
import '../../domain/repositories/chat_repository.dart';
import '../widgets/pinned_message_banner.dart';

class ChatConversationPage extends StatefulWidget {
  final int chatId;
  final ChatDialog? initialDialog;

  const ChatConversationPage({
    super.key,
    required this.chatId,
    this.initialDialog,
  });

  @override
  State<ChatConversationPage> createState() => _ChatConversationPageState();
}

class _ChatConversationPageState extends State<ChatConversationPage> {
  late final ChatRepository _chatRepository;
  bool _isLoading = true;
  List<ChatMessage> _messages = [];
  ChatMessage? _pinnedMessage;

  @override
  void initState() {
    super.initState();
    _chatRepository = sl<ChatRepository>();
    _loadChatData();
  }

  Future<void> _loadChatData() async {
    setState(() => _isLoading = true);
    try {
      final results = await Future.wait([
        _chatRepository.getMessages(widget.chatId, limit: 50),
        _chatRepository.getPinnedMessage(widget.chatId),
      ]);
      if (mounted) {
        setState(() {
          _messages = results[0] as List<ChatMessage>;
          _pinnedMessage = results[1] as ChatMessage?;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _pinMessage(ChatMessage msg) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16.r),
          side: BorderSide(color: AppColors.cardBorder, width: 1.w),
        ),
        title: Text(
          '¿Fijar mensaje en el chat?',
          style: TextStyle(
            fontSize: 16.sp,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        content: Text(
          '¿Deseas fijar el mensaje #${msg.id} en la parte superior para todos los miembros?',
          style: TextStyle(
            fontSize: 13.sp,
            color: AppColors.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
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
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              'Fijar',
              style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        final pinned = await _chatRepository.pinMessage(widget.chatId, msg.id);
        setState(() => _pinnedMessage = pinned);
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error al fijar mensaje: $e')),
          );
        }
      }
    }
  }

  Future<void> _unpinMessage() async {
    if (_pinnedMessage == null) return;
    try {
      await _chatRepository.unpinMessage(widget.chatId, _pinnedMessage!.id);
      setState(() => _pinnedMessage = null);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al desfijar mensaje: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    ScreenUtil().adaptDeviceScreenSize(context);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Row(
          children: [
            Container(
              width: 32.r,
              height: 32.r,
              decoration: const BoxDecoration(
                color: AppColors.cyan,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  widget.initialDialog?.title.isNotEmpty == true
                      ? widget.initialDialog!.title[0].toUpperCase()
                      : 'C',
                  style: TextStyle(
                    fontSize: 14.sp,
                    fontWeight: FontWeight.bold,
                    color: Colors.black,
                  ),
                ),
              ),
            ),
            SizedBox(width: 10.w),
            Expanded(
              child: Text(
                widget.initialDialog?.title ?? 'Chat #${widget.chatId}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 16.sp,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Pinned Message Banner
          if (_pinnedMessage != null)
            PinnedMessageBanner(
              message: _pinnedMessage!,
              onTap: () {
                // Scroll to pinned message
              },
              onUnpin: _unpinMessage,
            ),

          // Message Feed
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: AppColors.cyan),
                  )
                : _messages.isEmpty
                    ? Center(
                        child: Text(
                          'No hay mensajes en esta conversación',
                          style: TextStyle(
                            fontSize: 13.sp,
                            color: AppColors.textMuted,
                          ),
                        ),
                      )
                    : ListView.builder(
                        padding: ScreenUtil.getPadding(horizontal: 12, vertical: 8),
                        reverse: true,
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final msg = _messages[index];
                          return GestureDetector(
                            onLongPress: () => _pinMessage(msg),
                            child: Align(
                              alignment: msg.isOutgoing
                                  ? Alignment.centerRight
                                  : Alignment.centerLeft,
                              child: Container(
                                margin: ScreenUtil.getMargin(vertical: 4),
                                padding: ScreenUtil.getPadding(horizontal: 14, vertical: 10),
                                constraints: BoxConstraints(
                                  maxWidth: ScreenUtil.width * 0.78,
                                ),
                                decoration: BoxDecoration(
                                  color: msg.isOutgoing
                                      ? const Color(0xFF1A3353)
                                      : const Color(0xFF172338),
                                  borderRadius: BorderRadius.circular(16.r).copyWith(
                                    bottomRight: msg.isOutgoing ? Radius.circular(2.r) : null,
                                    bottomLeft: !msg.isOutgoing ? Radius.circular(2.r) : null,
                                  ),
                                  border: Border.all(
                                    color: msg.isOutgoing
                                        ? const Color(0xFF2D527C)
                                        : const Color(0xFF22354E),
                                    width: 1.w,
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    if (msg.text.isNotEmpty)
                                      Text(
                                        msg.text,
                                        style: TextStyle(
                                          fontSize: 14.sp,
                                          color: AppColors.textPrimary,
                                        ),
                                      ),
                                    SizedBox(height: 4.h),
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        Text(
                                          msg.date,
                                          style: TextStyle(
                                            fontSize: 10.sp,
                                            color: AppColors.textMuted,
                                          ),
                                        ),
                                        if (msg.isOutgoing) ...[
                                          SizedBox(width: 4.w),
                                          Icon(
                                            Icons.done_all,
                                            size: 13.r,
                                            color: msg.isRead ? AppColors.cyan : AppColors.textMuted,
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
