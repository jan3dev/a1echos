const {
  withXcodeProject,
  withEntitlementsPlist,
  withDangerousMod,
  withInfoPlist,
} = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");
const plist = require("@expo/plist").default;
const {
  setupListenerInXcodeProject,
} = require("./withIosTranscriptionListener");

const TEMPLATES_DIR = path.join(__dirname, "templates");
const EXTENSION_NAME = "EchosKeyboard";
const EXTENSION_BUNDLE_ID = "com.a1lab.echos.EchosKeyboard";
const APP_GROUP = "group.com.a1lab.echos.shared";

/**
 * Reads a Swift template file.
 */
function readTemplate(filename) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, filename), "utf8");
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Adds the keyboard extension target to the Xcode project.
 */
function withKeyboardXcodeTarget(config) {
  return withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const targetName = EXTENSION_NAME;

    // Check if target already exists
    const existingTarget = proj.pbxTargetByName(targetName);
    if (existingTarget) {
      return config;
    }

    // Add the app extension target
    const target = proj.addTarget(
      targetName,
      "app_extension",
      targetName,
      EXTENSION_BUNDLE_ID,
    );

    // Create a PBX group for the extension source files
    const swiftFiles = [
      "EchosKeyboardViewController.swift",
      "KeyboardView.swift",
      "KeyboardLayout.swift",
      "KeyButton.swift",
      "MicButton.swift",
      "KeyboardTheme.swift",
      "AudioRecorder.swift",
      "IPCClient.swift",
      "HapticManager.swift",
    ];

    const extensionGroup = proj.addPbxGroup(swiftFiles, targetName, targetName);

    // Add the group to the main project group
    const mainGroupKey = proj.getFirstProject().firstProject.mainGroup;
    proj.addToPbxGroup(extensionGroup.uuid, mainGroupKey);

    // addTarget creates the target with empty buildPhases for app_extension type.
    // We must manually create Sources and Frameworks build phases and populate them.
    const buildFileSection = proj.hash.project.objects["PBXBuildFile"];
    const nativeTargets = proj.hash.project.objects["PBXNativeTarget"];
    const targetObj = nativeTargets[target.uuid];

    // Create PBXSourcesBuildPhase
    const sourcePhaseUuid = proj.generateUuid();
    if (!proj.hash.project.objects["PBXSourcesBuildPhase"]) {
      proj.hash.project.objects["PBXSourcesBuildPhase"] = {};
    }
    proj.hash.project.objects["PBXSourcesBuildPhase"][sourcePhaseUuid] = {
      isa: "PBXSourcesBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    proj.hash.project.objects["PBXSourcesBuildPhase"][
      `${sourcePhaseUuid}_comment`
    ] = "Sources";

    // Create PBXFrameworksBuildPhase
    const frameworkPhaseUuid = proj.generateUuid();
    if (!proj.hash.project.objects["PBXFrameworksBuildPhase"]) {
      proj.hash.project.objects["PBXFrameworksBuildPhase"] = {};
    }
    proj.hash.project.objects["PBXFrameworksBuildPhase"][frameworkPhaseUuid] = {
      isa: "PBXFrameworksBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    proj.hash.project.objects["PBXFrameworksBuildPhase"][
      `${frameworkPhaseUuid}_comment`
    ] = "Frameworks";

    // Add phases to the target
    targetObj.buildPhases = [
      { value: sourcePhaseUuid, comment: "Sources" },
      { value: frameworkPhaseUuid, comment: "Frameworks" },
    ];

    // Add Swift source files as PBXBuildFile entries to the Sources phase
    const sourcesPhase =
      proj.hash.project.objects["PBXSourcesBuildPhase"][sourcePhaseUuid];
    for (const child of extensionGroup.pbxGroup.children) {
      const fileRefUuid = child.value;
      const fileName = child.comment;
      const buildFileUuid = proj.generateUuid();

      buildFileSection[buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: fileRefUuid,
      };
      buildFileSection[`${buildFileUuid}_comment`] = `${fileName} in Sources`;

      sourcesPhase.files.push({
        value: buildFileUuid,
        comment: `${fileName} in Sources`,
      });
    }

    // Add system frameworks to the extension target
    const frameworks = ["AVFoundation", "UIKit", "AudioToolbox"];
    for (const fw of frameworks) {
      proj.addFramework(`${fw}.framework`, { target: target.uuid });
    }

    // Configure build settings for the extension target.
    // First, read main app's version settings so the extension matches.
    let mainAppVersion = "1.0";
    let mainAppBuildNumber = "1";
    const configurations = proj.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const c = configurations[key];
      if (!c.buildSettings) continue;
      const bid = (c.buildSettings.PRODUCT_BUNDLE_IDENTIFIER || "").replace(
        /^"|"$/g,
        "",
      );
      if (bid === "com.a1lab.echos" && c.buildSettings.MARKETING_VERSION) {
        mainAppVersion = c.buildSettings.MARKETING_VERSION;
        mainAppBuildNumber = c.buildSettings.CURRENT_PROJECT_VERSION || "1";
        break;
      }
    }

    // Apply settings to extension build configurations
    for (const key in configurations) {
      const config_entry = configurations[key];
      if (!config_entry.buildSettings) continue;
      const bid = (
        config_entry.buildSettings.PRODUCT_BUNDLE_IDENTIFIER || ""
      ).replace(/^"|"$/g, "");
      if (bid === EXTENSION_BUNDLE_ID) {
        config_entry.buildSettings.INFOPLIST_FILE = `${targetName}/Info.plist`;
        config_entry.buildSettings.CODE_SIGN_ENTITLEMENTS = `${targetName}/${targetName}.entitlements`;
        config_entry.buildSettings.SWIFT_VERSION = "5.0";
        config_entry.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = "16.0";
        config_entry.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
        config_entry.buildSettings.SKIP_INSTALL = "YES";
        config_entry.buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES =
          "YES";
        config_entry.buildSettings.MARKETING_VERSION = mainAppVersion;
        config_entry.buildSettings.CURRENT_PROJECT_VERSION = mainAppBuildNumber;
        config_entry.buildSettings.GENERATE_INFOPLIST_FILE = "NO";
      }
    }

    // Add the extension to the main app target
    const mainTarget = proj.getFirstTarget();
    if (mainTarget) {
      proj.addTargetDependency(mainTarget.firstTarget.uuid, [target.uuid]);

      // Manually create "Embed App Extensions" copy files build phase
      // using the EXISTING product reference (not addBuildPhase which creates orphans)
      const productRefUuid = target.productReference;
      const buildFileUuid = proj.generateUuid();
      const buildPhaseUuid = proj.generateUuid();

      // Add PBXBuildFile entry referencing the existing .appex product
      proj.hash.project.objects["PBXBuildFile"][buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: productRefUuid,
        settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
      };
      proj.hash.project.objects["PBXBuildFile"][`${buildFileUuid}_comment`] =
        `${targetName}.appex in Embed App Extensions`;

      // Add PBXCopyFilesBuildPhase for embedding
      proj.hash.project.objects["PBXCopyFilesBuildPhase"] =
        proj.hash.project.objects["PBXCopyFilesBuildPhase"] || {};
      proj.hash.project.objects["PBXCopyFilesBuildPhase"][buildPhaseUuid] = {
        isa: "PBXCopyFilesBuildPhase",
        buildActionMask: 2147483647,
        dstPath: '""',
        dstSubfolderSpec: 13, // 13 = PlugIns (app extensions destination)
        files: [buildFileUuid],
        name: '"Embed App Extensions"',
        runOnlyForDeploymentPostprocessing: 0,
      };
      proj.hash.project.objects["PBXCopyFilesBuildPhase"][
        `${buildPhaseUuid}_comment`
      ] = "Embed App Extensions";

      // Add the build phase to the main target's buildPhases array
      const nativeTargets = proj.hash.project.objects["PBXNativeTarget"];
      const mainTargetKey = mainTarget.firstTarget.uuid;
      if (nativeTargets[mainTargetKey]) {
        nativeTargets[mainTargetKey].buildPhases.push({
          value: buildPhaseUuid,
          comment: "Embed App Extensions",
        });
      }
    }

    // Also set up the transcription listener files in the main app target
    // (done here so all Xcode project mods happen in a single withXcodeProject)
    const projectName = config.modRequest.projectName || "Echos";
    setupListenerInXcodeProject(proj, projectName);

    return config;
  });
}

/**
 * Adds App Group entitlement to the main app.
 */
function withAppGroupEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    const entitlements = config.modResults;

    if (!entitlements["com.apple.security.application-groups"]) {
      entitlements["com.apple.security.application-groups"] = [];
    }

    const groups = entitlements["com.apple.security.application-groups"];
    if (!groups.includes(APP_GROUP)) {
      groups.push(APP_GROUP);
    }

    return config;
  });
}

/**
 * Writes the keyboard extension Swift source files, Info.plist, and entitlements
 * to the generated ios/ directory.
 */
function withKeyboardExtensionFiles(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosRoot = path.join(projectRoot, "ios");
      const extensionDir = path.join(iosRoot, EXTENSION_NAME);
      ensureDir(extensionDir);

      // Write Swift source files
      const swiftFiles = [
        "EchosKeyboardViewController.swift",
        "KeyboardView.swift",
        "KeyboardLayout.swift",
        "KeyButton.swift",
        "MicButton.swift",
        "KeyboardTheme.swift",
        "AudioRecorder.swift",
        "IPCClient.swift",
        "HapticManager.swift",
      ];

      for (const file of swiftFiles) {
        const templatePath = path.join(TEMPLATES_DIR, file);
        if (fs.existsSync(templatePath)) {
          fs.writeFileSync(
            path.join(extensionDir, file),
            fs.readFileSync(templatePath, "utf8"),
          );
        }
      }

      // Write extension Info.plist
      const infoPlist = {
        CFBundleDevelopmentRegion: "$(DEVELOPMENT_LANGUAGE)",
        CFBundleDisplayName: "Echos",
        CFBundleExecutable: "$(EXECUTABLE_NAME)",
        CFBundleIdentifier: "$(PRODUCT_BUNDLE_IDENTIFIER)",
        CFBundleInfoDictionaryVersion: "6.0",
        CFBundleName: "$(PRODUCT_NAME)",
        CFBundlePackageType: "$(PRODUCT_BUNDLE_PACKAGE_TYPE)",
        CFBundleShortVersionString: "$(MARKETING_VERSION)",
        CFBundleVersion: "$(CURRENT_PROJECT_VERSION)",
        NSExtension: {
          NSExtensionAttributes: {
            IsASCIICapable: false,
            PrefersRightToLeft: false,
            PrimaryLanguage: "en-US",
            RequestsOpenAccess: true,
          },
          NSExtensionPointIdentifier: "com.apple.keyboard-service",
          NSExtensionPrincipalClass:
            "$(PRODUCT_MODULE_NAME).EchosKeyboardViewController",
        },
        NSMicrophoneUsageDescription:
          "Echos Keyboard needs microphone access to transcribe your speech into text.",
      };

      fs.writeFileSync(
        path.join(extensionDir, "Info.plist"),
        plist.build(infoPlist),
      );

      // Write extension entitlements
      const entitlements = {
        "com.apple.security.application-groups": [APP_GROUP],
      };

      fs.writeFileSync(
        path.join(extensionDir, `${EXTENSION_NAME}.entitlements`),
        plist.build(entitlements),
      );

      return config;
    },
  ]);
}

/**
 * Composes all iOS keyboard extension modifications.
 */
function withIosKeyboardExtension(config) {
  config = withAppGroupEntitlement(config);
  config = withKeyboardExtensionFiles(config);
  config = withKeyboardXcodeTarget(config);
  return config;
}

module.exports = { withIosKeyboardExtension };
