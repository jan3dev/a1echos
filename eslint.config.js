// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
    rules: {
      "import/order": [
        "error",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
        },
      ],
      "react/react-in-jsx-scope": "off",
      // Mostly false positives here: refs read in handlers built during
      // render, and effects that sync state from props or native events.
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["plugins/**/*.js", "scripts/**/*.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        Buffer: "readonly",
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
      },
    },
  },
  {
    files: ["**/*.test.{ts,tsx}"],
    rules: {
      "import/no-unresolved": [
        "error",
        { ignore: ["@testing-library/react-native"] },
      ],
    },
  },
]);
