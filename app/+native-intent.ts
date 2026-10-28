// The keyboard's echos://voice-session link is handled natively in AppDelegate;
// since SDK 58 it also reaches JS, where it isn't a route.
export const redirectSystemPath = ({ path }: { path: string }) =>
  path.includes("voice-session") ? null : path;
