A reusable component library based on AQUA design system.

## Getting started

Add the dependency to your `pubspec.yaml` file:

```yaml
dependencies:
  ui_components:
    path: packages/ui_components/
```

## Usage

To use the components, you need to import the package in your Dart file:

```dart
import 'package:ui_components/ui_components.dart';
```

## Fonts

This package includes custom fonts that need to be declared in your app's `pubspec.yaml` file:

```yaml
flutter:
  fonts:
    - family: Manrope
      fonts:
        - asset: assets/fonts/manrope/Manrope-Regular.ttf
          weight: 400
        - asset: assets/fonts/manrope/Manrope-Medium.ttf
          weight: 500
        - asset: assets/fonts/manrope/Manrope-SemiBold.ttf
          weight: 600
    - family: PublicSans
      fonts:
        - asset: assets/fonts/public_sans/PublicSans-Regular.ttf
          weight: 400
        - asset: assets/fonts/public_sans/PublicSans-Medium.ttf
          weight: 500
        - asset: assets/fonts/public_sans/PublicSans-SemiBold.ttf
          weight: 600
```
