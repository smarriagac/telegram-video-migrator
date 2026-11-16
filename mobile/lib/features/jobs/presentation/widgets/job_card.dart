import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';
import '../../domain/entities/migration_job.dart';

class JobCard extends StatelessWidget {
  final MigrationJob job;
  final VoidCallback onPause;
  final VoidCallback onResume;
  final VoidCallback onCancel;

  const JobCard({
    super.key,
    required this.job,
    required this.onPause,
    required this.onResume,
    required this.onCancel,
  });

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor(job.status);

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
          // Header: Status Badge and Actions
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: ScreenUtil.getPadding(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6.r),
                  border: Border.all(color: statusColor.withValues(alpha: 0.35), width: 1.w),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6.r,
                      height: 6.r,
                      decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                    ),
                    SizedBox(width: 6.w),
                    Text(
                      job.status.toUpperCase(),
                      style: TextStyle(
                        fontSize: 10.sp,
                        fontWeight: FontWeight.bold,
                        color: statusColor,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (job.isRunning)
                    IconButton(
                      icon: Icon(Icons.pause, size: 18.r, color: AppColors.amber),
                      onPressed: onPause,
                      tooltip: 'Pausar',
                      padding: EdgeInsets.zero,
                      constraints: BoxConstraints(minWidth: 32.w, minHeight: 32.h),
                    ),
                  if (job.isPaused || job.isPending)
                    IconButton(
                      icon: Icon(Icons.play_arrow, size: 18.r, color: AppColors.cyan),
                      onPressed: onResume,
                      tooltip: 'Reanudar',
                      padding: EdgeInsets.zero,
                      constraints: BoxConstraints(minWidth: 32.w, minHeight: 32.h),
                    ),
                  if (!job.isCompleted)
                    IconButton(
                      icon: Icon(Icons.cancel_outlined, size: 18.r, color: AppColors.rose),
                      onPressed: onCancel,
                      tooltip: 'Cancelar',
                      padding: EdgeInsets.zero,
                      constraints: BoxConstraints(minWidth: 32.w, minHeight: 32.h),
                    ),
                ],
              ),
            ],
          ),
          SizedBox(height: 10.h),

          // Route: Source -> Destination
          Row(
            children: [
              Expanded(
                child: Text(
                  job.sourceTitle ?? 'Origen: ${job.sourceId}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.sp,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
              Padding(
                padding: ScreenUtil.getPadding(horizontal: 6),
                child: Icon(Icons.arrow_forward, size: 14.r, color: AppColors.cyan),
              ),
              Expanded(
                child: Text(
                  job.targetTitle ?? 'Destino: ${job.targetId}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.sp,
                    fontWeight: FontWeight.w600,
                    color: AppColors.cyan,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 12.h),

          // Progress Bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4.r),
            child: LinearProgressIndicator(
              value: job.progress,
              minHeight: 6.h,
              backgroundColor: AppColors.card,
              valueColor: AlwaysStoppedAnimation<Color>(statusColor),
            ),
          ),
          SizedBox(height: 8.h),

          // Footer metrics
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${job.processedVideos} / ${job.totalVideos} videos procesados',
                style: TextStyle(fontSize: 11.sp, color: AppColors.textSecondary),
              ),
              Text(
                '${job.progressPercent}%',
                style: TextStyle(
                  fontSize: 11.sp,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toUpperCase()) {
      case 'RUNNING':
        return AppColors.cyan;
      case 'COMPLETED':
        return AppColors.emerald;
      case 'PAUSED':
        return AppColors.amber;
      case 'FAILED':
        return AppColors.rose;
      default:
        return AppColors.textMuted;
    }
  }
}
