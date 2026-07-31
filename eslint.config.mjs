import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    // Preserve the existing codebase's React 19 behavior while upgrading the
    // security-sensitive toolchain. These rules are refactor guidance, not
    // correctness or security checks.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
    },
  },
  globalIgnores([".next/**", "build/**", "dist/**", ".vinext/**"]),
]);
