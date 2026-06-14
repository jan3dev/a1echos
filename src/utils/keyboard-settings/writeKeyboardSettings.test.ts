import { File } from "expo-file-system";

import { writeKeyboardSettings } from "./writeKeyboardSettings";

jest.mock("../log/log", () => ({
  FeatureFlag: { settings: "SETTINGS" },
  logWarn: jest.fn(),
}));

// `expo-file-system` is mocked globally in jest.setup.js: `File` is a jest.fn
// whose instances expose jest.fn write/delete/move and `exists: true`.
const FileMock = File as unknown as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logWarn } = require("../log/log") as { logWarn: jest.Mock };

interface MockFile {
  exists: boolean;
  write: jest.Mock;
  delete: jest.Mock;
  move: jest.Mock;
}

describe("writeKeyboardSettings", () => {
  beforeEach(() => {
    FileMock.mockClear();
    logWarn.mockClear();
  });

  it("stages to a tmp file then moves it into place", () => {
    writeKeyboardSettings({ autocorrect: true, hapticFeedback: true });

    // Two File handles created: the tmp sibling, then the target.
    expect(FileMock).toHaveBeenCalledTimes(2);
    const tmp = FileMock.mock.results[0].value as MockFile;
    const settings = FileMock.mock.results[1].value as MockFile;

    expect(tmp.write).toHaveBeenCalledWith(
      JSON.stringify({ autocorrect: true, hapticFeedback: true }),
    );
    expect(tmp.move).toHaveBeenCalledWith(settings);
    expect(logWarn).not.toHaveBeenCalled();
  });

  it("serializes the false values too", () => {
    writeKeyboardSettings({ autocorrect: false, hapticFeedback: false });

    const tmp = FileMock.mock.results[0].value as MockFile;
    expect(tmp.write).toHaveBeenCalledWith(
      JSON.stringify({ autocorrect: false, hapticFeedback: false }),
    );
  });

  it("deletes pre-existing tmp and target files before writing", () => {
    writeKeyboardSettings({ autocorrect: true, hapticFeedback: false });

    // The global mock reports exists: true, so both delete branches run.
    const tmp = FileMock.mock.results[0].value as MockFile;
    const settings = FileMock.mock.results[1].value as MockFile;
    expect(tmp.delete).toHaveBeenCalledTimes(1);
    expect(settings.delete).toHaveBeenCalledTimes(1);
  });

  it("skips the delete when files do not already exist", () => {
    const handle = (): MockFile => ({
      exists: false,
      write: jest.fn(),
      delete: jest.fn(),
      move: jest.fn(),
    });
    const tmp = handle();
    const settings = handle();
    FileMock.mockImplementationOnce(() => tmp).mockImplementationOnce(
      () => settings,
    );

    writeKeyboardSettings({ autocorrect: true, hapticFeedback: false });

    expect(tmp.delete).not.toHaveBeenCalled();
    expect(settings.delete).not.toHaveBeenCalled();
    expect(tmp.write).toHaveBeenCalled();
    expect(tmp.move).toHaveBeenCalledWith(settings);
  });

  it("swallows errors (fire-and-forget, never throws)", () => {
    FileMock.mockImplementationOnce(() => {
      throw new Error("disk full");
    });

    expect(() =>
      writeKeyboardSettings({ autocorrect: true, hapticFeedback: false }),
    ).not.toThrow();
    // Only one File handle was attempted before the failure aborted the write.
    expect(FileMock).toHaveBeenCalledTimes(1);
  });
});
