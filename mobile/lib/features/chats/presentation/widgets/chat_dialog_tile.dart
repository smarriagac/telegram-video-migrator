import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';
import '../../domain/entities/chat_dialog.dart';

class ChatDialogTile extends StatelessWidget {
  final ChatDialog dialog;
  final VoidCallback onTap;

  const ChatDialogTile({
    super.key,
    required this.dialog,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12.r),
      child: Container(
        padding: ScreenUtil.getPadding(horizontal: 14, vertical: 12),
        margin: ScreenUtil.getMargin(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(12.r),
          border: Border.all(color: AppColors.cardBorder, width: 1.w),
        ),
        child: Row(
          children: [
            // Avatar
            Container(
              width: 44.r,
              height: 44.r,
              decoration: BoxDecoration(
                color: _parseAvatarColor(dialog.avatarColor),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: Text(
                  dialog.title.isNotEmpty ? dialog.title[0].toUpperCase() : '?',
                  style: TextStyle(
                    fontSize: 18.sp,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
            SizedBox(width: 12.w),

            // Content Column
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          dialog.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 15.sp,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                      ),
                      if (dialog.lastDate != null)
                        Text(
                          dialog.lastDate!,
                          style: TextStyle(
                            fontSize: 11.sp,
                            color: AppColors.textMuted,
                          ),
                        ),
                    ],
                  ),
                  SizedBox(height: 4.h),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          dialog.lastMessage ?? 'Sin mensajes recientes',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13.sp,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ),
                      if (dialog.unreadCount > 0)
                        Container(
                          padding: ScreenUtil.getPadding(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.cyan,
                            borderRadius: BorderRadius.circular(10.r),
                          ),
                          child: Text(
                            '${dialog.unreadCount}',
                            style: TextStyle(
                              fontSize: 10.sp,
                              fontWeight: FontWeight.bold,
                              color: Colors.black,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _parseAvatarColor(String? colorStr) {
    if (colorStr == null || colorStr.isEmpty) return AppColors.cyan;
    final hex = colorStr.replaceAll('#', '');
    if (hex.length == 6) {
      return Color(int.parse('FF$hex', radix: 16));
    }
    return AppColors.cyan;
  }
}
