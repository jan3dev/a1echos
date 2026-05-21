import { getErrorMessage } from "./getErrorMessage";

describe("getErrorMessage", () => {
  it("returns Error.message for Error instances", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values", () => {
    expect(getErrorMessage("plain string")).toBe("plain string");
    expect(getErrorMessage(42)).toBe("42");
    expect(getErrorMessage(null)).toBe("null");
    expect(getErrorMessage(undefined)).toBe("undefined");
    expect(getErrorMessage({ code: 1 })).toBe("[object Object]");
  });

  it("uses subclass message", () => {
    class MyError extends Error {}
    expect(getErrorMessage(new MyError("custom"))).toBe("custom");
  });
});
