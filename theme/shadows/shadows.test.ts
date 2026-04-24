import { Platform } from "react-native";

import { getShadow, shadows } from "./shadows";

describe("shadows", () => {
  const keys = Object.keys(shadows);

  it("has exactly 12 keys", () => {
    expect(keys).toHaveLength(12);
    expect(keys).toEqual([
      "default",
      "small",
      "medium",
      "large",
      "menu",
      "toast",
      "card",
      "cardElevated",
      "modal",
      "input",
      "button",
      "recordingButton",
    ]);
  });

  it("every shadow has all 5 ShadowStyle properties", () => {
    for (const key of keys) {
      const shadow = shadows[key as keyof typeof shadows];
      expect(shadow).toHaveProperty("shadowColor");
      expect(shadow).toHaveProperty("shadowOffset");
      expect(shadow).toHaveProperty("shadowOpacity");
      expect(shadow).toHaveProperty("shadowRadius");
      expect(shadow).toHaveProperty("elevation");
    }
  });

  it("shadowOffset has width/height numbers, shadowOpacity between 0 and 1", () => {
    for (const key of keys) {
      const shadow = shadows[key as keyof typeof shadows];
      expect(typeof shadow.shadowOffset.width).toBe("number");
      expect(typeof shadow.shadowOffset.height).toBe("number");
      expect(shadow.shadowOpacity).toBeGreaterThanOrEqual(0);
      expect(shadow.shadowOpacity).toBeLessThanOrEqual(1);
    }
  });

  it("modal shadow has negative offset height", () => {
    expect(shadows.modal.shadowOffset.height).toBe(-2);
    expect(shadows.modal.shadowOpacity).toBe(0.1);
    expect(shadows.modal.shadowRadius).toBe(8);
  });

  it("all shadows have elevation 0 on iOS (default test environment)", () => {
    for (const key of keys) {
      const shadow = shadows[key as keyof typeof shadows];
      expect(shadow.elevation).toBe(0);
    }
  });

  it("shadows have non-zero elevation on android", () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Platform: P } = require("react-native");
      P.OS = "android";
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { shadows: androidShadows } = require("./shadows");
      expect(androidShadows.default.elevation).toBe(2);
      expect(androidShadows.small.elevation).toBe(2);
      expect(androidShadows.medium.elevation).toBe(4);
      expect(androidShadows.large.elevation).toBe(8);
      expect(androidShadows.modal.elevation).toBe(5);
    });
  });
});

describe("getShadow", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it("on iOS returns shadow style without overflow property", () => {
    Platform.OS = "ios";
    const result = getShadow("default");
    expect(result).not.toHaveProperty("overflow");
    expect(result).toHaveProperty("shadowColor");
    expect(result).toHaveProperty("shadowOffset");
  });

  it("on Android returns shadow style with overflow visible", () => {
    Platform.OS = "android";
    const result = getShadow("default");
    expect(result).toHaveProperty("overflow", "visible");
    expect(result).toHaveProperty("shadowColor");
  });

  it("returns correct shadow for a given key", () => {
    Platform.OS = "ios";
    const result = getShadow("modal");
    expect(result.shadowOffset).toEqual({ width: 0, height: -2 });
  });
});
