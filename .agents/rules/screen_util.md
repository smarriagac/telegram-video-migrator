---
description: Enforce ScreenUtil responsive scaling on all Flutter views, widgets, and styles.
globs: mobile/lib/**/*.dart
always_on: true
---

# ScreenUtil Mandatory Rule

In all Flutter presentation code under `mobile/lib/`, you must use `ScreenUtil` from `package:telegram_migrator_mobile/core/utils/screen_util.dart`.

- Typography: Use `.sp` for `fontSize` (e.g. `fontSize: 14.sp`).
- Widths & Horizontal spacing: Use `.w` (e.g. `width: 240.w`, `SizedBox(width: 8.w)`).
- Heights & Vertical spacing: Use `.h` (e.g. `height: 48.h`, `SizedBox(height: 12.h)`).
- Radii & Square icons/sizes: Use `.r` (e.g. `BorderRadius.circular(12.r)`, `size: 20.r`).
- Margins and Paddings: Use `ScreenUtil.getPadding(...)` or `.w` / `.h` extensions.
- Strictly prohibited: Never use unscaled raw numeric literals for UI dimensions in Flutter widgets.
