import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { args: "none", argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.property.name='values'][property.name='sais_ui']",
          message: "Direct access to .values.sais_ui is forbidden. Use useSaisUi() hook or extractors from @/hooks/useSaisUi instead."
        },
        {
          selector: "MemberExpression[object.name='values'][property.name='sais_ui']",
          message: "Direct access to values.sais_ui (destructured) is forbidden. Use useSaisUi() hook instead."
        },
        {
          selector: "MemberExpression[object.name='values'][property.value='sais_ui']",
          message: "Direct access to values['sais_ui'] (bracket) is forbidden. Use useSaisUi() hook instead."
        }
      ],
    },
  },
  // Exemption for adapter files that need direct sais_ui access
  {
    files: ["src/hooks/useSaisUi.ts", "src/hooks/useSaisUi.test.ts"],
    rules: {
      "no-restricted-syntax": "off"
    }
  },
);
