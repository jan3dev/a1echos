const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

/**
 * withIosSceneLifecycle — lets the app launch when built with the iOS 27 SDK.
 *
 * UIKit in the iOS 27 SDK traps at launch unless the app adopts the UIScene
 * life cycle ("UIScene life cycle is required for apps built with this SDK").
 * Expo adopts it in SDK 58 (opt-in on 57); SDK 55 doesn't, so we do it here.
 *
 * A manifest alone is not enough: the process survives but renders black,
 * because the window AppDelegate builds is never attached to the scene. The
 * window has to be created from the UIWindowScene, so React Native startup
 * moves into a SceneDelegate. It is appended to AppDelegate.swift (same
 * module) so `$(PRODUCT_MODULE_NAME).SceneDelegate` resolves without pbxproj
 * edits. URL and user-activity callbacks are forwarded to AppDelegate's
 * existing handlers, which keep working (keyboard `echos://` links included).
 *
 * Remove once the project is on Expo SDK 58.
 */
const MARKER = "// withIosSceneLifecycle";

const SCENE_DELEGATE = `
${MARKER}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else { return }
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else {
      NSLog("withIosSceneLifecycle: React Native factory missing; scene has no window")
      return
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window

    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: appDelegate.launchOptions)

    // application(_:open:options:) is never called under the scene life cycle,
    // so a cold-start deep link (expo-dev-client's Metro URL included) arrives
    // here instead.
    for context in connectionOptions.urlContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
    for activity in connectionOptions.userActivities {
      _ = appDelegate.application(
        UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
  }

  func sceneDidBecomeActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?
      .applicationDidBecomeActive(UIApplication.shared)
  }

  func sceneWillResignActive(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?
      .applicationWillResignActive(UIApplication.shared)
  }

  func sceneWillEnterForeground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?
      .applicationWillEnterForeground(UIApplication.shared)
  }

  func sceneDidEnterBackground(_ scene: UIScene) {
    (UIApplication.shared.delegate as? AppDelegate)?
      .applicationDidEnterBackground(UIApplication.shared)
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    for context in URLContexts {
      _ = appDelegate.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
    _ = appDelegate.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

// Matched separately: other plugins may inject lines between the two.
const WINDOW_RE =
  /^[ \t]*window = UIWindow\(frame: UIScreen\.main\.bounds\)\r?\n/m;
const START_RN_RE =
  /^[ \t]*factory\.startReactNative\(\r?\n[\s\S]*?launchOptions: launchOptions\)\r?\n/m;
const WINDOW_PROPERTY = "  var window: UIWindow?\n";

const withSceneAppDelegate = (config) =>
  withAppDelegate(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (contents.includes(MARKER)) return cfg;

    if (!WINDOW_RE.test(contents)) {
      throw new Error(
        "withIosSceneLifecycle: AppDelegate.swift has no window creation; the Expo template changed and this plugin needs updating",
      );
    }
    if (!START_RN_RE.test(contents)) {
      throw new Error(
        "withIosSceneLifecycle: AppDelegate.swift has no startReactNative call; the Expo template changed and this plugin needs updating",
      );
    }
    if (!contents.includes(WINDOW_PROPERTY)) {
      throw new Error(
        "withIosSceneLifecycle: AppDelegate.swift has no `window` property",
      );
    }

    contents = contents
      .replace(WINDOW_RE, "    self.launchOptions = launchOptions\n")
      .replace(START_RN_RE, "")
      .replace(
        WINDOW_PROPERTY,
        WINDOW_PROPERTY +
          "  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n",
      );

    cfg.modResults.contents = contents + SCENE_DELEGATE;
    return cfg;
  });

const withSceneManifest = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return cfg;
  });

module.exports = (config) => withSceneManifest(withSceneAppDelegate(config));
