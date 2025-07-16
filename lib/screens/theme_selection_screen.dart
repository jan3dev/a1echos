import 'package:flutter/material.dart';
import 'package:ui_components/ui_components.dart';
import '../constants/app_constants.dart';

class ThemeSelectionScreen extends StatefulWidget {
  const ThemeSelectionScreen({super.key});

  @override
  State<ThemeSelectionScreen> createState() => _ThemeSelectionScreenState();
}

class _ThemeSelectionScreenState extends State<ThemeSelectionScreen> {
  // TODO: Replace with provider logic if available
  String _selectedTheme = 'auto';

  void _onSelect(String value) {
    setState(() {
      _selectedTheme = value;
    });
    // TODO: Update provider here
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final aquaColors = AquaColors.lightColors;
    return Scaffold(
      backgroundColor: aquaColors.surfaceBackground,
      appBar: AquaTopAppBar(colors: aquaColors, title: AppStrings.themeTitle),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Container(
          decoration: BoxDecoration(
            color: aquaColors.surfacePrimary,
            borderRadius: BorderRadius.circular(8),
            boxShadow: [
              BoxShadow(
                color: aquaColors.surfaceInverse.withOpacity(0.04),
                blurRadius: 16,
                offset: const Offset(0, 0),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AquaListItem(
                title: AppStrings.auto,
                iconTrailing: AquaRadio<String>(
                  value: 'auto',
                  groupValue: _selectedTheme,
                  onChanged: (_) => _onSelect('auto'),
                ),
                onTap: () => _onSelect('auto'),
                backgroundColor: aquaColors.surfacePrimary,
              ),
              Divider(height: 1, color: aquaColors.surfaceBorderPrimary),
              AquaListItem(
                title: AppStrings.light,
                iconTrailing: AquaRadio<String>(
                  value: 'light',
                  groupValue: _selectedTheme,
                  onChanged: (_) => _onSelect('light'),
                ),
                onTap: () => _onSelect('light'),
                backgroundColor: aquaColors.surfacePrimary,
              ),
              Divider(height: 1, color: aquaColors.surfaceBorderPrimary),
              AquaListItem(
                title: AppStrings.dark,
                iconTrailing: AquaRadio<String>(
                  value: 'dark',
                  groupValue: _selectedTheme,
                  onChanged: (_) => _onSelect('dark'),
                ),
                onTap: () => _onSelect('dark'),
                backgroundColor: aquaColors.surfacePrimary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
