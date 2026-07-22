const fs = require("fs");
const path = require("path");

const {
  withXcodeProject,
  withEntitlementsPlist,
  withDangerousMod,
} = require("expo/config-plugins");
const plist = require("@expo/plist").default;

const {
  setupListenerInXcodeProject,
} = require("./withIosTranscriptionListener");

const TEMPLATES_DIR = path.join(__dirname, "templates");
const EXTENSION_NAME = "EchosKeyboard";
const EXTENSION_BUNDLE_ID = "com.a1lab.echos.EchosKeyboard";
const APP_GROUP = "group.com.a1lab.echos.shared";

// Single source of truth for the extension's Swift sources — consumed by both
// the file-copy dangerous mod and the Xcode target setup so the two can't
// drift.
const EXTENSION_SWIFT_FILES = [
  "EchosKeyboardViewController.swift",
  "KeyboardView.swift",
  "KeyboardTopBar.swift",
  "KeyboardLayout.swift",
  "KeyButton.swift",
  "KeyPreviewView.swift",
  "KeyVariantsView.swift",
  "MicButton.swift",
  "KeyboardTheme.swift",
  "DeleteRepeater.swift",
  "EmojiData.swift",
  "EmojiPickerView.swift",
  "EmojiSearchIndex.swift",
  "EmojiSearchOverlayView.swift",
  "IPCClient.swift",
  "HapticManager.swift",
  "SpacingAndPunctuations.swift",
  "AutoCapEngine.swift",
  "DoubleSpacePeriod.swift",
  "RecapitalizeEngine.swift",
  "KeyboardSettings.swift",
  "SuggestionEngine.swift",
  "SuggestionStripView.swift",
  "CorrectionEngine.swift",
  "KeyAdjacency.swift",
  "UserLexicon.swift",
];

// Bundled (non-source) resources copied into the extension and added to a
// Resources build phase.
const DICTIONARY_FILE = "keyboard_dictionary.echd";
const DICTIONARY_SOURCE = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "data",
  "keyboard-dictionary",
  DICTIONARY_FILE,
);

// Curated context-aware confusable table (ill -> I'll etc.); a small JSON the
// engine parses at load. Ships as a bundle resource alongside the dictionary.
const CONFUSABLES_FILE = "confusables.json";
const CONFUSABLES_SOURCE = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "data",
  "keyboard-dictionary",
  CONFUSABLES_FILE,
);

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

    // Create a PBX group for the extension source files + bundled resources
    const groupFiles = [
      ...EXTENSION_SWIFT_FILES,
      DICTIONARY_FILE,
      CONFUSABLES_FILE,
    ];
    const extensionGroup = proj.addPbxGroup(groupFiles, targetName, targetName);

    // The xcode lib guesses `lastKnownFileType` poorly for the unknown .echd
    // extension — mark it as raw data so Xcode doesn't try to compile it.
    const fileRefSection = proj.hash.project.objects["PBXFileReference"];
    for (const child of extensionGroup.pbxGroup.children) {
      if (child.comment === DICTIONARY_FILE && fileRefSection[child.value]) {
        fileRefSection[child.value].lastKnownFileType = "file";
        delete fileRefSection[child.value].explicitFileType;
      }
    }

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

    // Create PBXResourcesBuildPhase (the dictionary binary ships as a bundle
    // resource; addTarget created none for app_extension targets)
    const resourcesPhaseUuid = proj.generateUuid();
    if (!proj.hash.project.objects["PBXResourcesBuildPhase"]) {
      proj.hash.project.objects["PBXResourcesBuildPhase"] = {};
    }
    proj.hash.project.objects["PBXResourcesBuildPhase"][resourcesPhaseUuid] = {
      isa: "PBXResourcesBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    proj.hash.project.objects["PBXResourcesBuildPhase"][
      `${resourcesPhaseUuid}_comment`
    ] = "Resources";

    // Add phases to the target
    targetObj.buildPhases = [
      { value: sourcePhaseUuid, comment: "Sources" },
      { value: frameworkPhaseUuid, comment: "Frameworks" },
      { value: resourcesPhaseUuid, comment: "Resources" },
    ];

    // Route group children by extension: .swift compiles in Sources, the
    // dictionary binary copies in Resources (feeding it to Sources would
    // break the build).
    const sourcesPhase =
      proj.hash.project.objects["PBXSourcesBuildPhase"][sourcePhaseUuid];
    const resourcesPhase =
      proj.hash.project.objects["PBXResourcesBuildPhase"][resourcesPhaseUuid];
    for (const child of extensionGroup.pbxGroup.children) {
      const fileRefUuid = child.value;
      const fileName = child.comment;
      const isSource = fileName.endsWith(".swift");
      const phase = isSource ? sourcesPhase : resourcesPhase;
      const phaseName = isSource ? "Sources" : "Resources";
      const buildFileUuid = proj.generateUuid();

      buildFileSection[buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: fileRefUuid,
      };
      buildFileSection[`${buildFileUuid}_comment`] =
        `${fileName} in ${phaseName}`;

      phase.files.push({
        value: buildFileUuid,
        comment: `${fileName} in ${phaseName}`,
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
      for (const file of EXTENSION_SWIFT_FILES) {
        const templatePath = path.join(TEMPLATES_DIR, file);
        if (fs.existsSync(templatePath)) {
          fs.writeFileSync(
            path.join(extensionDir, file),
            fs.readFileSync(templatePath, "utf8"),
          );
        }
      }

      // Copy the compiled correction dictionary (committed artifact — see
      // scripts/keyboard-dictionary/build.js) next to the sources; the Xcode
      // target adds it to the extension's Resources phase.
      fs.copyFileSync(
        DICTIONARY_SOURCE,
        path.join(extensionDir, DICTIONARY_FILE),
      );

      // Copy the confusables table next to the sources; the Xcode target adds
      // it to the extension's Resources phase (any non-.swift group file).
      fs.copyFileSync(
        CONFUSABLES_SOURCE,
        path.join(extensionDir, CONFUSABLES_FILE),
      );

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
