import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:ui_components_playground/shared/shared.dart';

import '../pages/pages.dart';
import '../providers/providers.dart';
import '../widgets/widgets.dart';

class HomeScreen extends HookConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = ref.watch(prefsProvider).selectedTheme;
    final selectedIndex = useState(0);
    final demoItems = {
      'Button': const ButtonDemoPage(),
      'Dimmer': const DimmerDemoPage(),
      'Footer': const FooterDemoPage(),
      'Header': const TopAppbarDemoPage(),
      'Icon': const IconDemoPage(),
      'List Item': const ListItemDemoPage(),
      'Modal Sheet': const ModalSheetDemoPage(),
      'Transcribe Buttons': const RecordingButtonDemoPage(),
      'Surface': const SurfaceDemoPage(),
      'Textfield': const TextfieldDemoPage(),
      'Transcription Item': const TranscriptionItemDemoPage(),
      'Tooltip': const TabChipTooltipDemoPage(),
      'Utility Item': const UtilityItemDemoPage(),
    };

    return Scaffold(
      appBar: const AquaAppBar(),
      backgroundColor: theme.colors.surfaceBackground,
      drawer: Drawer(
        child: SafeArea(
          child: ListView(
            padding: EdgeInsets.zero,
            children: demoItems.entries.indexed
                .map((e) => ListTile(
                      title: Text(e.$2.key),
                      onTap: () {
                        selectedIndex.value = e.$1;
                        Navigator.pop(context);
                      },
                    ))
                .toList(),
          ),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const BouncingScrollPhysics(),
          child: demoItems.values.elementAt(selectedIndex.value),
        ),
      ),
    );
  }
}
