import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:provider/provider.dart' as provider;
import 'l10n/app_localizations.dart';
import 'services/storage_service.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'providers/theme_provider.dart';
import 'screens/home_screen.dart';
import 'screens/settings_screen.dart';
import 'providers/session_provider.dart';
import 'providers/local_transcription_provider.dart';
import 'providers/settings_provider.dart';
import 'providers/transcription_data_provider.dart';
import 'package:flutter/services.dart';
import 'models/app_theme.dart';
import 'logger.dart';

Future<void> main() async {
  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      FlutterForegroundTask.initCommunicationPort();
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

      FlutterError.onError = (FlutterErrorDetails details) {
        logger.error(
          details.exception,
          stackTrace: details.stack,
          flag: FeatureFlag.ui,
        );
        FlutterError.presentError(details);
      };

      final settingsProvider = await SettingsProvider.create();
      final sharedPrefs = await SharedPreferences.getInstance();

      runApp(
        ProviderScope(
          overrides: [sharedPreferencesProvider.overrideWithValue(sharedPrefs)],
          child: provider.MultiProvider(
            providers: [
              provider.ChangeNotifierProvider.value(value: settingsProvider),
              provider.ChangeNotifierProvider(create: (_) => SessionProvider()),
              provider.ChangeNotifierProvider(
                create: (context) => TranscriptionDataProvider(
                  provider.Provider.of<SessionProvider>(context, listen: false),
                ),
              ),
              provider.ChangeNotifierProvider(
                create: (context) => LocalTranscriptionProvider(
                  provider.Provider.of<SessionProvider>(context, listen: false),
                ),
              ),
            ],
            child: const MyApp(),
          ),
        ),
      );
    },
    (Object error, StackTrace stack) {
      logger.error(error, stackTrace: stack, flag: FeatureFlag.general);
    },
  );
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);
    final lightTheme = ref.watch(lightThemeProvider);
    final darkTheme = ref.watch(darkThemeProvider);

    return MaterialApp(
      title: 'Echos',
      theme: lightTheme,
      darkTheme: darkTheme,
      themeMode: themeMode,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      initialRoute: '/',
      routes: {
        '/': (context) => const AppInitializer(child: HomeScreen()),
        '/settings': (context) => const SettingsScreen(),
      },
      builder: (context, child) {
        final appTheme = ref.watch(prefsProvider).selectedTheme;
        final isDark =
            (appTheme == AppTheme.dark) ||
            (appTheme == AppTheme.auto &&
                MediaQuery.of(context).platformBrightness == Brightness.dark);
        final statusBarIconBrightness = isDark
            ? Brightness.light
            : Brightness.dark;

        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: SystemUiOverlayStyle(
            statusBarColor: Colors.transparent,
            statusBarIconBrightness: statusBarIconBrightness,
            systemNavigationBarColor: Colors.transparent,
            systemNavigationBarIconBrightness: statusBarIconBrightness,
            systemStatusBarContrastEnforced: false,
            systemNavigationBarContrastEnforced: false,
          ),
          child: child!,
        );
      },
    );
  }
}

/// Widget to handle session validation on app start
class AppInitializer extends StatefulWidget {
  final Widget child;

  const AppInitializer({super.key, required this.child});

  @override
  State<AppInitializer> createState() => _AppInitializerState();
}

class _AppInitializerState extends State<AppInitializer> {
  late Future<void> _initFuture;

  @override
  void initState() {
    super.initState();
    _initFuture = StorageService().processPendingDeletes();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _initFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        return widget.child;
      },
    );
  }
}
