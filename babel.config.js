/* eslint-env node */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      // Inline .sql files as raw strings so drizzle migrations bundle inside
      // the JS bundle. Required by `drizzle-orm/expo-sqlite/migrator` which
      // expects `migrations` keyed by hash → SQL string.
      ["babel-plugin-inline-import", { extensions: [".sql"] }],
    ],
  };
};
