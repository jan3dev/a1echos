import { File, Paths } from "expo-file-system";

import { FeatureFlag, logWarn } from "../log/log";

/**
 * Serializes `value` and writes it to `<Paths.document>/<filename>` atomically:
 * stage to a sibling `.tmp` file, then move it into place so a reader never
 * parses a half-written file. Fire-and-forget — any failure is logged under
 * `flag` (tagged with `label`) and never propagates.
 *
 * Shared by the keyboard config writers (`writeKeyboardSettings`,
 * `writeKeyboardModelConfig`), whose native readers parse the file eagerly and
 * would throw on a truncated payload.
 */
export const writeJsonAtomic = (
  filename: string,
  value: unknown,
  options: { flag: FeatureFlag; label: string },
): void => {
  try {
    const tmpFile = new File(Paths.document, `${filename}.tmp`);
    if (tmpFile.exists) tmpFile.delete();
    tmpFile.write(JSON.stringify(value));

    const target = new File(Paths.document, filename);
    if (target.exists) target.delete();
    tmpFile.move(target);
  } catch (error) {
    logWarn(`Failed to write ${options.label}: ${error}`, {
      flag: options.flag,
    });
  }
};
