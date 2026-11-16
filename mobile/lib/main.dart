import 'package:flutter/material.dart';
import 'core/di/injection.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/utils/screen_util.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initDependencies();
  runApp(const TelegramMigratorMobileApp());
}

class TelegramMigratorMobileApp extends StatelessWidget {
  const TelegramMigratorMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Telegram Video Migrator Mobile',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      routerConfig: appRouter,
      builder: (context, child) {
        ScreenUtil().adaptDeviceScreenSize(context);
        return child ?? const SizedBox.shrink();
      },
    );
  }
}
