import { File } from "expo-file-system";

import * as logModule from "../log/log";

import {
  clearKeyboardLaunchMarker,
  readKeyboardLaunchMarker,
} from "./keyboardLaunchMarker";

const mockFile = File as unknown as jest.Mock;
const mockLogWarn = jest
  .spyOn(logModule, "logWarn")
  .mockImplementation(() => undefined);

const setupFile = (opts: {
  exists?: boolean;
  text?: string;
  textThrows?: boolean;
  deleteThrows?: boolean;
}): jest.Mock => {
  const del = jest.fn(() => {
    if (opts.deleteThrows) throw new Error("delete failed");
  });
  mockFile.mockImplementation(() => ({
    exists: opts.exists ?? true,
    text: async () => {
      if (opts.textThrows) throw new Error("read failed");
      return opts.text ?? "";
    },
    delete: del,
  }));
  return del;
};

describe("keyboardLaunchMarker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("readKeyboardLaunchMarker", () => {
    it("returns the marker when the file holds a valid openedAt", async () => {
      setupFile({ text: JSON.stringify({ openedAt: 1234 }) });
      expect(await readKeyboardLaunchMarker()).toEqual({ openedAt: 1234 });
    });

    it("returns null when the file does not exist", async () => {
      setupFile({ exists: false });
      expect(await readKeyboardLaunchMarker()).toBeNull();
    });

    it("returns null when openedAt is missing or not a number", async () => {
      setupFile({ text: JSON.stringify({ openedAt: "nope" }) });
      expect(await readKeyboardLaunchMarker()).toBeNull();
    });

    it("returns null and logs when the file is malformed", async () => {
      setupFile({ text: "not json" });
      expect(await readKeyboardLaunchMarker()).toBeNull();
      expect(mockLogWarn).toHaveBeenCalled();
    });

    it("returns null and logs when reading throws", async () => {
      setupFile({ textThrows: true });
      expect(await readKeyboardLaunchMarker()).toBeNull();
      expect(mockLogWarn).toHaveBeenCalled();
    });
  });

  describe("clearKeyboardLaunchMarker", () => {
    it("deletes the file when it exists", () => {
      const del = setupFile({ exists: true });
      clearKeyboardLaunchMarker();
      expect(del).toHaveBeenCalledTimes(1);
    });

    it("does nothing when the file is absent", () => {
      const del = setupFile({ exists: false });
      clearKeyboardLaunchMarker();
      expect(del).not.toHaveBeenCalled();
    });

    it("logs and swallows errors when delete throws", () => {
      setupFile({ exists: true, deleteThrows: true });
      expect(() => clearKeyboardLaunchMarker()).not.toThrow();
      expect(mockLogWarn).toHaveBeenCalled();
    });
  });
});
