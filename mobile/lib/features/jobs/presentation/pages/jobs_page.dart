import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';
import '../bloc/jobs_bloc.dart';
import '../bloc/jobs_event.dart';
import '../bloc/jobs_state.dart';
import '../widgets/job_card.dart';
import '../widgets/new_migration_modal.dart';

class JobsPage extends StatefulWidget {
  const JobsPage({super.key});

  @override
  State<JobsPage> createState() => _JobsPageState();
}

class _JobsPageState extends State<JobsPage> {
  @override
  void initState() {
    super.initState();
    context.read<JobsBloc>().add(const LoadJobsEvent());
  }

  void _openNewMigrationModal() {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => NewMigrationModal(
        onStart: (sourceId, targetId, isFull) {
          context.read<JobsBloc>().add(
                CreateJobEvent(
                  sourceId: sourceId,
                  targetId: targetId,
                  isFullMigration: isFull,
                ),
              );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ScreenUtil().adaptDeviceScreenSize(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Cola de Migraciones',
          style: TextStyle(
            fontSize: 18.sp,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, size: 20.r, color: AppColors.cyan),
            onPressed: () => context.read<JobsBloc>().add(const RefreshJobsEvent()),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.cyan,
        foregroundColor: Colors.black,
        icon: Icon(Icons.add, size: 20.r),
        label: Text(
          'Nueva Migración',
          style: TextStyle(fontSize: 13.sp, fontWeight: FontWeight.bold),
        ),
        onPressed: _openNewMigrationModal,
      ),
      body: BlocConsumer<JobsBloc, JobsState>(
        listener: (context, state) {
          if (state is JobsLoaded && state.actionMessage != null) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(state.actionMessage!),
                backgroundColor: AppColors.card,
                duration: const Duration(seconds: 2),
              ),
            );
          }
        },
        builder: (context, state) {
          if (state is JobsLoading) {
            return const Center(child: CircularProgressIndicator(color: AppColors.cyan));
          }

          if (state is JobsError) {
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
                      style: TextStyle(fontSize: 13.sp, color: AppColors.textSecondary),
                    ),
                    SizedBox(height: 16.h),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.cyan),
                      onPressed: () => context.read<JobsBloc>().add(const LoadJobsEvent()),
                      child: Text(
                        'Reintentar',
                        style: TextStyle(color: Colors.black, fontSize: 13.sp, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is JobsLoaded) {
            return RefreshIndicator(
              color: AppColors.cyan,
              backgroundColor: AppColors.surface,
              onRefresh: () async => context.read<JobsBloc>().add(const RefreshJobsEvent()),
              child: CustomScrollView(
                slivers: [
                  // KPI summary bar
                  SliverToBoxAdapter(
                    child: Container(
                      margin: ScreenUtil.getMargin(horizontal: 14, vertical: 10),
                      padding: ScreenUtil.getPadding(all: 12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12.r),
                        border: Border.all(color: AppColors.cardBorder, width: 1.w),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _statTile('Activas', '${state.runningCount}', AppColors.cyan),
                          Container(width: 1.w, height: 28.h, color: AppColors.cardBorder),
                          _statTile('Pausadas', '${state.pausedCount}', AppColors.amber),
                          Container(width: 1.w, height: 28.h, color: AppColors.cardBorder),
                          _statTile('Completadas', '${state.completedCount}', AppColors.emerald),
                        ],
                      ),
                    ),
                  ),

                  if (state.jobs.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Text(
                          'No hay tareas de migración en la cola',
                          style: TextStyle(fontSize: 13.sp, color: AppColors.textMuted),
                        ),
                      ),
                    )
                  else
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final job = state.jobs[index];
                          return JobCard(
                            job: job,
                            onPause: () => context.read<JobsBloc>().add(PauseJobEvent(job.id)),
                            onResume: () => context.read<JobsBloc>().add(ResumeJobEvent(job.id)),
                            onCancel: () => context.read<JobsBloc>().add(CancelJobEvent(job.id)),
                          );
                        },
                        childCount: state.jobs.length,
                      ),
                    ),
                ],
              ),
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }

  Widget _statTile(String label, String value, Color color) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 16.sp,
            fontWeight: FontWeight.bold,
            color: color,
            fontFamily: 'monospace',
          ),
        ),
        SizedBox(height: 2.h),
        Text(
          label,
          style: TextStyle(fontSize: 11.sp, color: AppColors.textSecondary),
        ),
      ],
    );
  }
}
