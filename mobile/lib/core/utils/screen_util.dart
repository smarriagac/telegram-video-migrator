// ignore_for_file: non_constant_identifier_names

import 'dart:ui';
import 'package:flutter/material.dart';

/// Responsive sizing utilities based on standard design dimensions (360×812).
/// Automatically clamps scaling on large screens (desktop/tablet) so mobile layouts
/// do not blow up in size.
class ScreenUtil {
  ScreenUtil._();

  factory ScreenUtil() => _instance;
  static final ScreenUtil _instance = ScreenUtil._();

  // Design baseline dimensions
  static num DESIGN_WIDTH = 360;
  static num DESIGN_HEIGHT = 812;

  static num get STATUS_BAR_HEIGHT => MediaQueryData.fromView(
        PlatformDispatcher.instance.views.first,
      ).viewPadding.top;

  static num _width = 360;
  static num _height = 812;
  static bool _adapted = false;

  /// Whether [adaptDeviceScreenSize] has been called with a valid size.
  static bool get isAdapted => _adapted;

  void adaptDeviceScreenSize(BuildContext context) {
    final size = MediaQuery.sizeOf(context);
    // On tablet/desktop the UI is bounded inside max-width container (maxWidth: 540)
    // Never allow effective viewport to exceed 430px width for proportional mobile scaling.
    final effectiveWidth = size.width > 540 ? 412.0 : (size.width > 0 ? size.width : 360.0);
    final effectiveHeight = size.height > 920 ? 840.0 : (size.height > 0 ? size.height : 812.0);
    _width = effectiveWidth;
    _height = effectiveHeight;
    _adapted = true;
  }

  /// Unified scale factor (min of width/height ratios) clamped safely.
  static double getScaleFactor() {
    if (_width == 0 || _height == 0) return 1.0;
    final scaleWidth = _width / DESIGN_WIDTH;
    final scaleHeight = _height / DESIGN_HEIGHT;
    final minScale = scaleWidth < scaleHeight ? scaleWidth.toDouble() : scaleHeight.toDouble();
    return minScale.clamp(0.85, 1.15);
  }

  static double get width => _width * 1.0;
  static double get height => _height * 1.0;

  static bool get isTablet => _width > 600;
  static bool get isDesktop => _width > 1200;
  static bool get isMobile => _width <= 600;
  static bool get isLandscape => _width > _height;
  static bool get isPortrait => _height >= _width;

  static double getSafeHeight(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    return mediaQuery.size.height -
        mediaQuery.padding.top -
        mediaQuery.padding.bottom;
  }

  static double getHorizontalSize(double px) {
    if (_width == 0) return px;
    final scale = (_width / DESIGN_WIDTH).clamp(0.85, 1.15);
    return px * scale;
  }

  static double getVerticalSize(double px) {
    if (_height == 0) return px;
    final scale = (_height / DESIGN_HEIGHT).clamp(0.85, 1.15);
    return px * scale;
  }

  static double getSize(double px) => px * getScaleFactor();

  static double getFontSize(double px) {
    if (_width == 0) return px;
    // Scale conservatively: ±12% max to keep crisp typography and prevent overflows
    final scale = (_width / DESIGN_WIDTH).clamp(0.9, 1.12);
    return px * scale;
  }

  static double getResponsiveSize(double mobile, double tablet, double desktop) {
    if (_width > 1200) return getSize(desktop);
    if (_width > 600) return getSize(tablet);
    return getSize(mobile);
  }

  static EdgeInsets getPadding({
    double? all,
    double? horizontal,
    double? vertical,
    double? left,
    double? top,
    double? right,
    double? bottom,
  }) {
    return getMarginOrPadding(
      all: all,
      horizontal: horizontal,
      vertical: vertical,
      left: left,
      top: top,
      right: right,
      bottom: bottom,
    );
  }

  static EdgeInsets getMargin({
    double? all,
    double? horizontal,
    double? vertical,
    double? left,
    double? top,
    double? right,
    double? bottom,
  }) {
    return getMarginOrPadding(
      all: all,
      horizontal: horizontal,
      vertical: vertical,
      left: left,
      top: top,
      right: right,
      bottom: bottom,
    );
  }

  static EdgeInsets getMarginOrPadding({
    double? all,
    double? horizontal,
    double? vertical,
    double? left,
    double? top,
    double? right,
    double? bottom,
  }) {
    if (all != null) {
      left = all;
      top = all;
      right = all;
      bottom = all;
    }
    if (horizontal != null) {
      left = horizontal;
      right = horizontal;
    }
    if (vertical != null) {
      top = vertical;
      bottom = vertical;
    }
    return EdgeInsets.only(
      left: getHorizontalSize(left ?? 0),
      top: getVerticalSize(top ?? 0),
      right: getHorizontalSize(right ?? 0),
      bottom: getVerticalSize(bottom ?? 0),
    );
  }
}

/// Shorthand extensions for Figma/design-px values.
extension ScreenUtilNumX on num {
  double get w => ScreenUtil.getHorizontalSize(toDouble());
  double get h => ScreenUtil.getVerticalSize(toDouble());
  double get r => ScreenUtil.getSize(toDouble());
  double get sp => ScreenUtil.getFontSize(toDouble());
}
