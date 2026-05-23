/* eslint-env node */
/**
 * withFileProtection — OS-level protection wiring for Echos's at-rest data.
 *
 * iOS:     sets NSFileProtectionDefault to
 *          NSFileProtectionCompleteUntilFirstUserAuthentication so all files
 *          in the app sandbox inherit this protection class unless
 *          overridden. Works in tandem with the echos-file-protection module
 *          which sets the class on specific paths.
 *
 * Android: writes an XML backup rules file that excludes both the SQLCipher
 *          database and the audio directory from Auto Backup / cloud restore.
 *          A backup of an encrypted DB without the Keystore-backed master key
 *          looks like data loss to the user — excluding avoids the confusion.
 */
const {
  withInfoPlist,
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require("@expo/config-plugins");
const path = require("path");
const fs = require("fs");

const PROTECTION_CLASS = "NSFileProtectionCompleteUntilFirstUserAuthentication";
const BACKUP_RULES_FILENAME = "echos_backup_rules.xml";
const BACKUP_RULES_RESOURCE = `@xml/${BACKUP_RULES_FILENAME.replace(/\.xml$/, "")}`;

const BACKUP_RULES_XML = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <!-- SQLCipher DB is unrestorable without the Keystore-backed master key. -->
  <exclude domain="database" path="echos.db"/>
  <exclude domain="database" path="echos.db-journal"/>
  <exclude domain="database" path="echos.db-wal"/>
  <exclude domain="database" path="echos.db-shm"/>
  <exclude domain="file" path="SQLite/echos.db"/>
  <exclude domain="file" path="SQLite/echos.db-journal"/>
  <exclude domain="file" path="SQLite/echos.db-wal"/>
  <exclude domain="file" path="SQLite/echos.db-shm"/>
  <!-- Audio files: encrypted with a per-device Keystore master key. -->
  <exclude domain="file" path="audio"/>
</full-backup-content>
`;

const withIos = (config) =>
  withInfoPlist(config, (c) => {
    c.modResults.NSFileProtectionDefault = PROTECTION_CLASS;
    return c;
  });

const withAndroidBackupRulesFile = (config) =>
  withDangerousMod(config, [
    "android",
    async (c) => {
      const resXmlDir = path.join(
        c.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      fs.mkdirSync(resXmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(resXmlDir, BACKUP_RULES_FILENAME),
        BACKUP_RULES_XML,
      );
      return c;
    },
  ]);

const withAndroidBackupAttribute = (config) =>
  withAndroidManifest(config, (c) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      c.modResults,
    );
    application.$["android:fullBackupContent"] = BACKUP_RULES_RESOURCE;
    application.$["android:dataExtractionRules"] = BACKUP_RULES_RESOURCE;
    return c;
  });

const withFileProtection = (config) => {
  config = withIos(config);
  config = withAndroidBackupRulesFile(config);
  config = withAndroidBackupAttribute(config);
  return config;
};

module.exports = withFileProtection;
