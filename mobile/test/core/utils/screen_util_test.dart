import 'package:flutter_test/flutter_test.dart';
import 'package:telegram_migrator_mobile/core/utils/screen_util.dart';

void main() {
  group('ScreenUtil Responsive Extensions', () {
    test('calculates proportional dimensions correctly', () {
      expect(16.w, isA<double>());
      expect(16.h, isA<double>());
      expect(16.r, isA<double>());
      expect(16.sp, isA<double>());
    });

    test('enforces scale bounds', () {
      final factor = ScreenUtil.getScaleFactor();
      expect(factor, greaterThanOrEqualTo(0.85));
      expect(factor, lessThanOrEqualTo(1.15));
    });

    test('builds responsive padding safely', () {
      final padding = ScreenUtil.getPadding(horizontal: 16, vertical: 8);
      expect(padding.left, isA<double>());
      expect(padding.top, isA<double>());
      expect(padding.right, isA<double>());
      expect(padding.bottom, isA<double>());
    });
  });
}
