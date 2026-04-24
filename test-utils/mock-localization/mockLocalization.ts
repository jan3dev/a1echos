/**
 * Creates a Proxy-based mock for `loc` that returns callable values
 * with proper `toString()` for use in both template literals and JSX.
 *
 * - `loc.someKey` → function with `toString() => "someKey"`
 * - `loc.someKey("arg")` → `"someKey_arg"`
 * - `${loc.someKey}` → `"someKey"` (via toString)
 * - `<Text>{String(loc.someKey)}</Text>` → renders `"someKey"`
 */
export function mockMakeLoc() {
  return new Proxy(
    {},
    {
      get: (_, p) => {
        if (typeof p !== "string") return undefined;
        const fn = (...args: any[]) =>
          args.length ? `${String(p)}_${args[0]}` : String(p);
        fn.toString = () => String(p);
        return fn;
      },
    },
  );
}
