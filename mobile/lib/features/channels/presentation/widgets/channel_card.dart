import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';
import '../../domain/entities/managed_channel.dart';

class ChannelCard extends StatelessWidget {
  final ManagedChannel channel;
  final VoidCallback? onMigrate;

  const ChannelCard({
    super.key,
    required this.channel,
    this.onMigrate,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: ScreenUtil.getMargin(horizontal: 14, vertical: 6),
      padding: ScreenUtil.getPadding(all: 14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14.r),
        border: Border.all(color: AppColors.cardBorder, width: 1.w),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 40.r,
                height: 40.r,
                decoration: BoxDecoration(
                  color: AppColors.cyan.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10.r),
                  border: Border.all(
                    color: AppColors.cyan.withValues(alpha: 0.3),
                    width: 1.w,
                  ),
                ),
                child: Center(
                  child: Icon(
                    Icons.campaign_outlined,
                    color: AppColors.cyan,
                    size: 22.r,
                  ),
                ),
              ),
              SizedBox(width: 12.w),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      channel.title,
                      style: TextStyle(
                        fontSize: 14.sp,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    SizedBox(height: 3.h),
                    Text(
                      channel.username != null ? '@${channel.username}' : 'ID: ${channel.id}',
                      style: TextStyle(
                        fontSize: 12.sp,
                        color: AppColors.textSecondary,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: ScreenUtil.getPadding(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: channel.canPost
                      ? AppColors.emerald.withValues(alpha: 0.15)
                      : AppColors.amber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6.r),
                  border: Border.all(
                    color: channel.canPost
                        ? AppColors.emerald.withValues(alpha: 0.4)
                        : AppColors.amber.withValues(alpha: 0.4),
                    width: 1.w,
                  ),
                ),
                child: Text(
                  channel.canPost ? 'ESCRITURA' : 'SOLO LECTURA',
                  style: TextStyle(
                    fontSize: 9.sp,
                    fontWeight: FontWeight.bold,
                    color: channel.canPost ? AppColors.emerald : AppColors.amber,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          Divider(color: AppColors.cardBorder, height: 1.h),
          SizedBox(height: 10.h),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.perm_identity, size: 14.r, color: AppColors.textMuted),
                  SizedBox(width: 4.w),
                  Text(
                    channel.accountName ?? 'Cuenta Principal',
                    style: TextStyle(fontSize: 11.sp, color: AppColors.textMuted),
                  ),
                ],
              ),
              if (onMigrate != null)
                InkWell(
                  onTap: onMigrate,
                  borderRadius: BorderRadius.circular(6.r),
                  child: Container(
                    padding: ScreenUtil.getPadding(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.card,
                      borderRadius: BorderRadius.circular(6.r),
                      border: Border.all(color: AppColors.cardBorder, width: 1.w),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.play_arrow, size: 14.r, color: AppColors.cyan),
                        SizedBox(width: 4.w),
                        Text(
                          'Migrar',
                          style: TextStyle(
                            fontSize: 11.sp,
                            fontWeight: FontWeight.w600,
                            color: AppColors.cyan,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
