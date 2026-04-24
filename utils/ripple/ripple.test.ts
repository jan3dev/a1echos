import { Platform } from "react-native";

import { iosPressed } from "./ripple";

describe("iosPressed", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  describe("iOS", () => {
    beforeEach(() => {
      Platform.OS = "ios";
    });

    it("returns default opacity when pressed", () => {
      expect(iosPressed(true)).toBe(0.7);
    });

    it("returns custom opacity when pressed", () => {
      expect(iosPressed(true, 0.5)).toBe(0.5);
    });

    it("returns 1 when not pressed", () => {
      expect(iosPressed(false)).toBe(1);
    });

    it("returns 1 when not pressed with custom opacity", () => {
      expect(iosPressed(false, 0.5)).toBe(1);
    });
  });

  describe("Android", () => {
    beforeEach(() => {
      Platform.OS = "android";
    });

    it("returns 1 when pressed", () => {
      expect(iosPressed(true)).toBe(1);
    });

    it("returns 1 when not pressed", () => {
      expect(iosPressed(false)).toBe(1);
    });

    it("returns 1 regardless of custom opacity", () => {
      expect(iosPressed(true, 0.3)).toBe(1);
    });
  });
});
