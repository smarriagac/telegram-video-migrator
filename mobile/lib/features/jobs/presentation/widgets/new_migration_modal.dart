import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';

class NewMigrationModal extends StatefulWidget {
  final Function(int sourceId, int targetId, bool isFullMigration) onStart;

  const NewMigrationModal({super.key, required this.onStart});

  @override
  State<NewMigrationModal> createState() => _NewMigrationModalState();
}

class _NewMigrationModalState extends State<NewMigrationModal> {
  final _sourceController = TextEditingController();
  final _targetController = TextEditingController();
  bool _isFullMigration = true;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        left: 18.w,
        right: 18.w,
        top: 20.h,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20.h,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20.r)),
        border: Border.all(color: AppColors.cardBorder, width: 1.w),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Nueva Tarea de Migración',
                style: TextStyle(
                  fontSize: 16.sp,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              IconButton(
                icon: Icon(Icons.close, size: 18.r, color: AppColors.textMuted),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          SizedBox(height: 12.h),
          Text(
            'ID Canal de Origen:',
            style: TextStyle(fontSize: 12.sp, color: AppColors.textSecondary),
          ),
          SizedBox(height: 6.h),
          TextField(
            controller: _sourceController,
            keyboardType: TextInputType.number,
            style: TextStyle(fontSize: 13.sp, color: AppColors.textPrimary),
            decoration: InputDecoration(
              hintText: 'Ej: -1004337257363',
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
          SizedBox(height: 12.h),
          Text(
            'ID Canal de Destino:',
            style: TextStyle(fontSize: 12.sp, color: AppColors.textSecondary),
          ),
          SizedBox(height: 6.h),
          TextField(
            controller: _targetController,
            keyboardType: TextInputType.number,
            style: TextStyle(fontSize: 13.sp, color: AppColors.textPrimary),
            decoration: InputDecoration(
              hintText: 'Ej: -1003926247405',
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
          SizedBox(height: 12.h),
          Row(
            children: [
              Checkbox(
                value: _isFullMigration,
                activeColor: AppColors.cyan,
                onChanged: (val) => setState(() => _isFullMigration = val ?? true),
              ),
              Text(
                'Migración completa (todos los videos históricos)',
                style: TextStyle(fontSize: 12.sp, color: AppColors.textSecondary),
              ),
            ],
          ),
          SizedBox(height: 16.h),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.cyan,
                foregroundColor: Colors.black,
                padding: ScreenUtil.getPadding(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)),
              ),
              onPressed: () {
                final source = int.tryParse(_sourceController.text.trim());
                final target = int.tryParse(_targetController.text.trim());
                if (source != null && target != null) {
                  widget.onStart(source, target, _isFullMigration);
                  Navigator.of(context).pop();
                }
              },
              child: Text(
                'Iniciar Migración',
                style: TextStyle(fontSize: 14.sp, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
