import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    ignores: ["**/node_modules/**", "**/dist/**", "client/src/assets/**"],
  },
  {
    // Applies to every workspace: Node/browser globals differ per package,
    // but we keep one shared baseline of language options here rather than
    // repeating it per file group.
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  {
    // React-specific rules scoped only to the client's JSX source, so the
    // server and game-engine packages (plain Node, no React) never see
    // React lint rules applied to them.
    files: ["client/src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        fetch: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off", // not needed with the modern JSX transform
      // This project is plain JS with no `prop-types` dependency (a
      // deliberate MVP simplicity choice, see Phase 1 tooling notes) -
      // enforcing PropTypes validation without that package installed
      // would just be noise, not a real safety net.
      "react/prop-types": "off",
    },
    settings: { react: { version: "detect" } },
  },
  {
    // Node-only globals for server and game-engine (process, console, the
    // built-in fetch/timer globals available in Node 18+, etc.)
    files: ["server/**/*.js", "packages/**/*.js"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
  },
  prettierConfig,
];
