import { delay } from "./delay";

describe("delay", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns a Promise", () => {
    const result = delay(100);
    expect(result).toBeInstanceOf(Promise);
    jest.runAllTimers();
  });

  it("resolves after specified ms", async () => {
    let resolved = false;
    delay(500).then(() => {
      resolved = true;
    });

    jest.advanceTimersByTime(499);
    await Promise.resolve();
    expect(resolved).toBe(false);

    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(resolved).toBe(true);
  });

  it("resolves with undefined", async () => {
    const promise = delay(100);
    jest.runAllTimers();
    const result = await promise;
    expect(result).toBeUndefined();
  });

  it("works with 0ms", async () => {
    const promise = delay(0);
    jest.runAllTimers();
    const result = await promise;
    expect(result).toBeUndefined();
  });
});
