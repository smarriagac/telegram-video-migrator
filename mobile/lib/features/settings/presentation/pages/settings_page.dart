import 'package:flutter/material.dart';
import '../../../../core/di/injection.dart';
import '../../../../core/network/api_client.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/screen_util.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final TextEditingController _urlController;
  bool _isTesting = false;
  String? _testResult;
  bool? _isSuccess;
  int? _latencyMs;

  @override
  void initState() {
    super.initState();
    final client = sl<ApiClient>();
    _urlController = TextEditingController(text: client.baseUrl);
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _testConnection() async {
    setState(() {
      _isTesting = true;
      _testResult = null;
      _isSuccess = null;
      _latencyMs = null;
    });

    final targetUrl = _urlController.text.trim();
    final tempClient = ApiClient(baseUrl: targetUrl);
    final stopwatch = Stopwatch()..start();

    try {
      await tempClient.get('/api/dialogs');
      stopwatch.stop();
      if (!mounted) return;
      setState(() {
        _isTesting = false;
        _isSuccess = true;
        _latencyMs = stopwatch.elapsedMilliseconds;
        _testResult = 'Conexión exitosa con el backend FastAPI.';
      });
    } catch (e) {
      stopwatch.stop();
      if (!mounted) return;
      setState(() {
        _isTesting = false;
        _isSuccess = false;
        _latencyMs = stopwatch.elapsedMilliseconds;
        _testResult = 'Fallo de conexión: $e';
      });
    }
  }

  void _saveUrl() {
    final newUrl = _urlController.text.trim();
    if (newUrl.isEmpty) return;

    sl<ApiClient>().setBaseUrl(newUrl);

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Servidor actualizado a: $newUrl'),
        backgroundColor: AppColors.surface,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    ScreenUtil().adaptDeviceScreenSize(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Configuración & Diagnóstico',
          style: TextStyle(
            fontSize: 18.sp,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimary,
          ),
        ),
      ),
      body: ListView(
        padding: ScreenUtil.getPadding(horizontal: 14, vertical: 12),
        children: [
          // Section: Server Endpoint
          _buildCard(
            title: 'Servidor Backend FastAPI',
            icon: Icons.dns_outlined,
            children: [
              Text(
                'Ingresá la dirección IP y puerto del servidor local o remoto donde corre el backend de Telegram Video Migrator.',
                style: TextStyle(fontSize: 12.sp, color: AppColors.textSecondary),
              ),
              SizedBox(height: 12.h),
              TextField(
                controller: _urlController,
                style: TextStyle(fontSize: 13.sp, color: AppColors.textPrimary, fontFamily: 'monospace'),
                decoration: InputDecoration(
                  labelText: 'URL del Servidor',
                  labelStyle: TextStyle(fontSize: 12.sp, color: AppColors.cyan),
                  hintText: 'http://192.168.1.35:7901',
                  hintStyle: TextStyle(fontSize: 12.sp, color: AppColors.textMuted),
                  filled: true,
                  fillColor: AppColors.card,
                  contentPadding: ScreenUtil.getPadding(horizontal: 12, vertical: 10),
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
              SizedBox(height: 12.h),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.cyan,
                        side: BorderSide(color: AppColors.cyan, width: 1.w),
                        padding: ScreenUtil.getPadding(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)),
                      ),
                      onPressed: _isTesting ? null : _testConnection,
                      icon: _isTesting
                          ? SizedBox(
                              width: 14.r,
                              height: 14.r,
                              child: const CircularProgressIndicator(strokeWidth: 2, color: AppColors.cyan),
                            )
                          : Icon(Icons.speed, size: 16.r),
                      label: Text(
                        _isTesting ? 'Probando...' : 'Probar Latencia',
                        style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  SizedBox(width: 10.w),
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.cyan,
                        foregroundColor: Colors.black,
                        padding: ScreenUtil.getPadding(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10.r)),
                      ),
                      onPressed: _saveUrl,
                      icon: Icon(Icons.save_outlined, size: 16.r),
                      label: Text(
                        'Guardar URL',
                        style: TextStyle(fontSize: 12.sp, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                ],
              ),
              if (_testResult != null) ...[
                SizedBox(height: 12.h),
                Container(
                  padding: ScreenUtil.getPadding(all: 10),
                  decoration: BoxDecoration(
                    color: _isSuccess == true
                        ? AppColors.emerald.withValues(alpha: 0.12)
                        : AppColors.rose.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8.r),
                    border: Border.all(
                      color: _isSuccess == true
                          ? AppColors.emerald.withValues(alpha: 0.4)
                          : AppColors.rose.withValues(alpha: 0.4),
                      width: 1.w,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _isSuccess == true ? Icons.check_circle : Icons.error,
                        color: _isSuccess == true ? AppColors.emerald : AppColors.rose,
                        size: 18.r,
                      ),
                      SizedBox(width: 8.w),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _testResult!,
                              style: TextStyle(
                                fontSize: 11.sp,
                                color: _isSuccess == true ? AppColors.emerald : AppColors.rose,
                              ),
                            ),
                            if (_latencyMs != null)
                              Text(
                                'Latencia RTT: ${_latencyMs}ms',
                                style: TextStyle(
                                  fontSize: 10.sp,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                  fontFamily: 'monospace',
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),

          SizedBox(height: 14.h),

          // Section: App Telemetry & System Specs
          _buildCard(
            title: 'Información del Cliente',
            icon: Icons.info_outline,
            children: [
              _infoRow('App Version', '1.0.0+1 (Release Candidate)'),
              _infoRow('Arquitectura', 'Feature-First Clean Architecture'),
              _infoRow('Gestor de Estado', 'BLoC Pattern (flutter_bloc 9.x)'),
              _infoRow('Enrutamiento', 'GoRouter (StatefulShellRoute)'),
              _infoRow('Responsividad', 'ScreenUtil Adaptive Scaler'),
              _infoRow('Modo de Color', 'Cyber Dark (#090A0F, #0E1015)'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCard({
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
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
              Icon(icon, size: 18.r, color: AppColors.cyan),
              SizedBox(width: 8.w),
              Text(
                title,
                style: TextStyle(
                  fontSize: 14.sp,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          SizedBox(height: 10.h),
          Divider(color: AppColors.cardBorder, height: 1.h),
          SizedBox(height: 12.h),
          ...children,
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: ScreenUtil.getPadding(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 12.sp, color: AppColors.textSecondary),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 12.sp,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}
