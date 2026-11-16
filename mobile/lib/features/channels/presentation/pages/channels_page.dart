import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';
import '../bloc/channels_bloc.dart';
import '../bloc/channels_event.dart';
import '../bloc/channels_state.dart';
import '../widgets/channel_card.dart';

class ChannelsPage extends StatefulWidget {
  const ChannelsPage({super.key});

  @override
  State<ChannelsPage> createState() => _ChannelsPageState();
}

class _ChannelsPageState extends State<ChannelsPage> {
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    context.read<ChannelsBloc>().add(const LoadChannelsEvent());
  }

  @override
  Widget build(BuildContext context) {
    ScreenUtil().adaptDeviceScreenSize(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Canales Gestionados',
          style: TextStyle(
            fontSize: 18.sp,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, size: 20.r, color: AppColors.cyan),
            onPressed: () => context.read<ChannelsBloc>().add(const RefreshChannelsEvent()),
          ),
        ],
      ),
      body: BlocBuilder<ChannelsBloc, ChannelsState>(
        builder: (context, state) {
          if (state is ChannelsLoading) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.cyan),
            );
          }

          if (state is ChannelsError) {
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
                      onPressed: () =>
                          context.read<ChannelsBloc>().add(const LoadChannelsEvent()),
                      child: Text(
                        'Reintentar',
                        style: TextStyle(
                          color: Colors.black,
                          fontSize: 13.sp,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          if (state is ChannelsLoaded) {
            final filtered = state.channels.where((c) {
              final query = _searchQuery.toLowerCase();
              return c.title.toLowerCase().contains(query) ||
                  (c.username != null && c.username!.toLowerCase().contains(query)) ||
                  c.id.toString().contains(query);
            }).toList();

            return RefreshIndicator(
              color: AppColors.cyan,
              backgroundColor: AppColors.surface,
              onRefresh: () async =>
                  context.read<ChannelsBloc>().add(const RefreshChannelsEvent()),
              child: CustomScrollView(
                slivers: [
                  // Search Bar
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: ScreenUtil.getPadding(horizontal: 14, top: 10, bottom: 6),
                      child: TextField(
                        onChanged: (val) => setState(() => _searchQuery = val),
                        style: TextStyle(fontSize: 13.sp, color: AppColors.textPrimary),
                        decoration: InputDecoration(
                          hintText: 'Buscar canal por nombre, @ o ID...',
                          hintStyle: TextStyle(fontSize: 13.sp, color: AppColors.textMuted),
                          prefixIcon: Icon(Icons.search, size: 18.r, color: AppColors.textMuted),
                          filled: true,
                          fillColor: AppColors.surface,
                          contentPadding: ScreenUtil.getPadding(horizontal: 14, vertical: 10),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10.r),
                            borderSide: BorderSide(color: AppColors.cardBorder, width: 1.w),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10.r),
                            borderSide: BorderSide(color: AppColors.cardBorder, width: 1.w),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(10.r),
                            borderSide: BorderSide(color: AppColors.cyan, width: 1.w),
                          ),
                        ),
                      ),
                    ),
                  ),

                  // KPI summary
                  SliverToBoxAdapter(
                    child: Container(
                      margin: ScreenUtil.getMargin(horizontal: 14, vertical: 6),
                      padding: ScreenUtil.getPadding(all: 12),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(12.r),
                        border: Border.all(color: AppColors.cardBorder, width: 1.w),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _kpiItem('Total Canales', '${state.channels.length}', AppColors.cyan),
                          Container(width: 1.w, height: 28.h, color: AppColors.cardBorder),
                          _kpiItem('Con Escritura', '${state.postableCount}', AppColors.emerald),
                          Container(width: 1.w, height: 28.h, color: AppColors.cardBorder),
                          _kpiItem(
                            'Solo Lectura',
                            '${state.channels.length - state.postableCount}',
                            AppColors.amber,
                          ),
                        ],
                      ),
                    ),
                  ),

                  if (filtered.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: Center(
                        child: Text(
                          _searchQuery.isEmpty
                              ? 'No se encontraron canales gestionados'
                              : 'No hay canales que coincidan con la búsqueda',
                          style: TextStyle(fontSize: 13.sp, color: AppColors.textMuted),
                        ),
                      ),
                    )
                  else
                    SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final channel = filtered[index];
                          return ChannelCard(channel: channel);
                        },
                        childCount: filtered.length,
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

  Widget _kpiItem(String label, String value, Color color) {
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
