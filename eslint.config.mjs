import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // React Three Fiber code mutates three.js objects (cameras, uniforms, matrices) inside
  // useFrame by design. The React Compiler purity rules don't model that, and the compiler
  // itself is not enabled, so they are turned off for 3D/scene code only.
  {
    files: [
      "src/features/**/scene/**/*.{ts,tsx}",
      "src/features/series/PuppetLab.tsx",
      "src/features/home/*Scene*.tsx",
      "src/shared/puppets/**/*.{ts,tsx}",
    ],
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/use-memo": "off",
      "react-hooks/refs": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
