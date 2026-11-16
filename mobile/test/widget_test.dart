import 'package:flutter_test/flutter_test.dart';
import 'package:telegram_migrator_mobile/core/theme/app_theme.dart';

void main() {
  test('AppTheme provides consistent dark cyber palette', () {
    final theme = AppTheme.darkTheme;
    expect(theme.scaffoldBackgroundColor, AppColors.background);
    expect(theme.colorScheme.primary, AppColors.cyan);
  });
}
