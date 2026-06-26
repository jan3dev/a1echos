const fs = require("fs");
const path = require("path");

const {
  withXcodeProject,
  withInfoPlist,
  withDangerousMod,
} = require("expo/config-plugins");
const plist = require("@expo/plist").default;

const TEMPLATES_DIR = path.join(__dirname, "templates");
const WIDGET_NAME = "EchosWidget";
const WIDGET_BUNDLE_ID = "com.a1lab.echos.EchosWidget";
const MAIN_BUNDLE_ID = "com.a1lab.echos";

// Swift sources compiled into the widget extension target.
const WIDGET_SWIFT_FILES = [
  "EchosWidgetBundle.swift",
  "EchoSessionLiveActivity.swift",
  "EchoSessionAttributes.swift",
];

// Shared with the main app target so the listener can start/end the activity.
// A second copy is compiled into the app; ActivityKit matches across the two
// processes by the attributes type name.
const SHARED_ATTRIBUTES_FILE = "EchoSessionAttributes.swift";

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Declares `NSSupportsLiveActivities` in the main app Info.plist. Without it,
 * `Activity.request` fails at runtime.
 */
function withLiveActivityInfoPlist(config) {
  return withInfoPlist(config, (config) => {
    config.modResults.NSSupportsLiveActivities = true;
    return config;
  });
}

/**
 * Writes the widget extension Swift sources + Info.plist to ios/EchosWidget/,
 * and a copy of the shared ActivityAttributes into the main app dir.
 */
function withLiveActivityFiles(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const projectName = config.modRequest.projectName || "Echos";
      const iosRoot = path.join(projectRoot, "ios");
      const widgetDir = path.join(iosRoot, WIDGET_NAME);
      ensureDir(widgetDir);

      for (const file of WIDGET_SWIFT_FILES) {
        const templatePath = path.join(TEMPLATES_DIR, file);
        if (fs.existsSync(templatePath)) {
          fs.writeFileSync(
            path.join(widgetDir, file),
            fs.readFileSync(templatePath, "utf8"),
          );
        }
      }

      // Copy the shared attributes into the main app target's dir too, so the
      // app compiles its own (identical) copy of the type.
      const mainAppDir = path.join(iosRoot, projectName);
      const attrsTemplate = path.join(TEMPLATES_DIR, SHARED_ATTRIBUTES_FILE);
      if (fs.existsSync(attrsTemplate)) {
        fs.writeFileSync(
          path.join(mainAppDir, SHARED_ATTRIBUTES_FILE),
          fs.readFileSync(attrsTemplate, "utf8"),
        );
      }

      // Widget extension Info.plist. WidgetKit extensions use a @main
      // WidgetBundle (no NSExtensionPrincipalClass).
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
          NSExtensionPointIdentifier: "com.apple.widgetkit-extension",
        },
      };
      fs.writeFileSync(
        path.join(widgetDir, "Info.plist"),
        plist.build(infoPlist),
      );

      return config;
    },
  ]);
}

/**
 * Adds the shared ActivityAttributes file to the MAIN app target's Sources
 * build phase so the app can compile `EchoSessionAttributes`.
 */
function addSharedAttributesToMainTarget(proj, projectName) {
  const mainTarget = proj.getFirstTarget();
  if (!mainTarget) return;
  const mainTargetUuid = mainTarget.uuid;

  // Find the main app group to register the file reference under.
  const groups = proj.hash.project.objects["PBXGroup"];
  const mainGroupKey = proj.getFirstProject().firstProject.mainGroup;
  let appGroupKey = null;
  const mainGroup = groups[mainGroupKey];
  if (mainGroup && mainGroup.children) {
    for (const child of mainGroup.children) {
      const g = groups[child.value];
      if (g && (g.name === projectName || g.path === projectName)) {
        appGroupKey = child.value;
        break;
      }
    }
  }

  const fileRefSection = proj.hash.project.objects["PBXFileReference"];
  const buildFileSection = proj.hash.project.objects["PBXBuildFile"];

  const refUuid = proj.generateUuid();
  fileRefSection[refUuid] = {
    isa: "PBXFileReference",
    lastKnownFileType: "sourcecode.swift",
    name: SHARED_ATTRIBUTES_FILE,
    path: `${projectName}/${SHARED_ATTRIBUTES_FILE}`,
    sourceTree: '"<group>"',
  };
  fileRefSection[`${refUuid}_comment`] = SHARED_ATTRIBUTES_FILE;

  if (appGroupKey && groups[appGroupKey]) {
    groups[appGroupKey].children.push({
      value: refUuid,
      comment: SHARED_ATTRIBUTES_FILE,
    });
  }

  const buildFileUuid = proj.generateUuid();
  buildFileSection[buildFileUuid] = { isa: "PBXBuildFile", fileRef: refUuid };
  buildFileSection[`${buildFileUuid}_comment`] =
    `${SHARED_ATTRIBUTES_FILE} in Sources`;

  const nativeTargets = proj.hash.project.objects["PBXNativeTarget"];
  const targetObj = nativeTargets[mainTargetUuid];
  if (targetObj) {
    const sourcePhases = proj.hash.project.objects["PBXSourcesBuildPhase"];
    for (const bp of targetObj.buildPhases) {
      const bpUuid = bp.value || bp;
      if (sourcePhases[bpUuid]) {
        sourcePhases[bpUuid].files.push({
          value: buildFileUuid,
          comment: `${SHARED_ATTRIBUTES_FILE} in Sources`,
        });
        break;
      }
    }
  }
}

/**
 * Adds the EchosWidget app-extension target to the Xcode project, mirroring the
 * keyboard-extension target setup (which the project already ships) but with
 * WidgetKit/ActivityKit frameworks and the widgetkit-extension point.
 */
function withLiveActivityXcodeTarget(config) {
  return withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const targetName = WIDGET_NAME;
    const projectName = config.modRequest.projectName || "Echos";

    if (proj.pbxTargetByName(targetName)) {
      return config;
    }

    const target = proj.addTarget(
      targetName,
      "app_extension",
      targetName,
      WIDGET_BUNDLE_ID,
    );

    // PBX group for the widget sources.
    const widgetGroup = proj.addPbxGroup(
      WIDGET_SWIFT_FILES,
      targetName,
      targetName,
    );
    const mainGroupKey = proj.getFirstProject().firstProject.mainGroup;
    proj.addToPbxGroup(widgetGroup.uuid, mainGroupKey);

    // addTarget gives an app_extension empty buildPhases — create Sources and
    // Frameworks phases and populate them (same approach as the keyboard).
    const buildFileSection = proj.hash.project.objects["PBXBuildFile"];
    const nativeTargets = proj.hash.project.objects["PBXNativeTarget"];
    const targetObj = nativeTargets[target.uuid];

    const sourcePhaseUuid = proj.generateUuid();
    proj.hash.project.objects["PBXSourcesBuildPhase"] =
      proj.hash.project.objects["PBXSourcesBuildPhase"] || {};
    proj.hash.project.objects["PBXSourcesBuildPhase"][sourcePhaseUuid] = {
      isa: "PBXSourcesBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    proj.hash.project.objects["PBXSourcesBuildPhase"][
      `${sourcePhaseUuid}_comment`
    ] = "Sources";

    const frameworkPhaseUuid = proj.generateUuid();
    proj.hash.project.objects["PBXFrameworksBuildPhase"] =
      proj.hash.project.objects["PBXFrameworksBuildPhase"] || {};
    proj.hash.project.objects["PBXFrameworksBuildPhase"][frameworkPhaseUuid] = {
      isa: "PBXFrameworksBuildPhase",
      buildActionMask: 2147483647,
      files: [],
      runOnlyForDeploymentPostprocessing: 0,
    };
    proj.hash.project.objects["PBXFrameworksBuildPhase"][
      `${frameworkPhaseUuid}_comment`
    ] = "Frameworks";

    targetObj.buildPhases = [
      { value: sourcePhaseUuid, comment: "Sources" },
      { value: frameworkPhaseUuid, comment: "Frameworks" },
    ];

    const sourcesPhase =
      proj.hash.project.objects["PBXSourcesBuildPhase"][sourcePhaseUuid];
    for (const child of widgetGroup.pbxGroup.children) {
      const buildFileUuid = proj.generateUuid();
      buildFileSection[buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: child.value,
      };
      buildFileSection[`${buildFileUuid}_comment`] =
        `${child.comment} in Sources`;
      sourcesPhase.files.push({
        value: buildFileUuid,
        comment: `${child.comment} in Sources`,
      });
    }

    for (const fw of ["SwiftUI", "WidgetKit", "ActivityKit"]) {
      proj.addFramework(`${fw}.framework`, { target: target.uuid });
    }

    // Match the main app's version, like the keyboard target does.
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
      if (bid === MAIN_BUNDLE_ID && c.buildSettings.MARKETING_VERSION) {
        mainAppVersion = c.buildSettings.MARKETING_VERSION;
        mainAppBuildNumber = c.buildSettings.CURRENT_PROJECT_VERSION || "1";
        break;
      }
    }

    for (const key in configurations) {
      const c = configurations[key];
      if (!c.buildSettings) continue;
      const bid = (c.buildSettings.PRODUCT_BUNDLE_IDENTIFIER || "").replace(
        /^"|"$/g,
        "",
      );
      if (bid === WIDGET_BUNDLE_ID) {
        c.buildSettings.INFOPLIST_FILE = `${targetName}/Info.plist`;
        c.buildSettings.SWIFT_VERSION = "5.0";
        // Live Activities / ActivityContent require iOS 16.2; the widget only
        // hosts the Live Activity, so it can deploy higher than the 16.0 app.
        c.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = "16.2";
        c.buildSettings.TARGETED_DEVICE_FAMILY = '"1,2"';
        c.buildSettings.SKIP_INSTALL = "YES";
        c.buildSettings.ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = "YES";
        c.buildSettings.MARKETING_VERSION = mainAppVersion;
        c.buildSettings.CURRENT_PROJECT_VERSION = mainAppBuildNumber;
        c.buildSettings.GENERATE_INFOPLIST_FILE = "NO";
      }
    }

    // Embed the widget .appex into the app and add the dependency.
    const mainTarget = proj.getFirstTarget();
    if (mainTarget) {
      proj.addTargetDependency(mainTarget.firstTarget.uuid, [target.uuid]);

      const productRefUuid = target.productReference;
      const embedBuildFileUuid = proj.generateUuid();
      const embedPhaseUuid = proj.generateUuid();

      proj.hash.project.objects["PBXBuildFile"][embedBuildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: productRefUuid,
        settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
      };
      proj.hash.project.objects["PBXBuildFile"][
        `${embedBuildFileUuid}_comment`
      ] = `${targetName}.appex in Embed App Extensions`;

      proj.hash.project.objects["PBXCopyFilesBuildPhase"] =
        proj.hash.project.objects["PBXCopyFilesBuildPhase"] || {};
      proj.hash.project.objects["PBXCopyFilesBuildPhase"][embedPhaseUuid] = {
        isa: "PBXCopyFilesBuildPhase",
        buildActionMask: 2147483647,
        dstPath: '""',
        dstSubfolderSpec: 13, // PlugIns (app extensions)
        files: [embedBuildFileUuid],
        name: '"Embed App Extensions"',
        runOnlyForDeploymentPostprocessing: 0,
      };
      proj.hash.project.objects["PBXCopyFilesBuildPhase"][
        `${embedPhaseUuid}_comment`
      ] = "Embed App Extensions";

      const mainTargetKey = mainTarget.firstTarget.uuid;
      if (nativeTargets[mainTargetKey]) {
        nativeTargets[mainTargetKey].buildPhases.push({
          value: embedPhaseUuid,
          comment: "Embed App Extensions",
        });
      }
    }

    // Compile the shared attributes into the main app target as well.
    addSharedAttributesToMainTarget(proj, projectName);

    return config;
  });
}

/**
 * Composes the iOS Live Activity (voice-session indicator) modifications:
 * a WidgetKit extension target hosting the Live Activity, the shared
 * ActivityAttributes compiled into the app, and NSSupportsLiveActivities.
 */
function withIosLiveActivity(config) {
  config = withLiveActivityInfoPlist(config);
  config = withLiveActivityFiles(config);
  config = withLiveActivityXcodeTarget(config);
  return config;
}

module.exports = { withIosLiveActivity };
