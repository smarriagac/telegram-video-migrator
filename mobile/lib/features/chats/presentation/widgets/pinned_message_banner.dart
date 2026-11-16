import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';
import '../../domain/entities/chat_message.dart';

class PinnedMessageBanner extends StatelessWidget {
  final ChatMessage message;
  final VoidCallback onTap;
  final VoidCallback onUnpin;

  const PinnedMessageBanner({
    super.key,
    required this.message,
    required this.onTap,
    required this.onUnpin,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: ScreenUtil.getPadding(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF0E1726),
          border: Border(
            bottom: BorderSide(
              color: AppColors.cyan.withValues(alpha: 0.3),
              width: 1.w,
            ),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 2.w,
              height: 24.h,
              decoration: BoxDecoration(
                color: AppColors.cyan,
                borderRadius: BorderRadius.circular(2.r),
              ),
            ),
            SizedBox(width: 10.w),
            Icon(Icons.push_pin, size: 16.r, color: AppColors.cyan),
            SizedBox(width: 8.w),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Mensaje fijado #${message.id}',
                    style: TextStyle(
                      fontSize: 11.sp,
                      fontWeight: FontWeight.bold,
                      color: AppColors.cyan,
                    ),
                  ),
                  SizedBox(height: 2.h),
                  Text(
                    message.text.isNotEmpty
                        ? message.text
                        : (message.mediaType != null ? '[${message.mediaType!.toUpperCase()}]' : 'Sin texto'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11.sp,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              icon: Icon(Icons.close, size: 16.r, color: AppColors.textMuted),
              onPressed: onUnpin,
              splashRadius: 16.r,
              padding: EdgeInsets.zero,
              constraints: BoxConstraints(minWidth: 28.w, minHeight: 28.h),
            ),
          ],
        ),
      ),
    );
  }
}
