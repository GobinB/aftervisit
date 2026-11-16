import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const storeBan = {
  group: ["@/store", "@/store/*", "@/store/**"],
  message: "app/ and components/ never import from store/. Call a service or a server action.",
};

const supabaseBan = {
  group: ["@supabase/*", "@supabase/**"],
  message: "Only store/ may import @supabase packages. app/(auth) and proxy.ts may import @supabase/ssr.",
};

const supabaseJsBan = {
  group: ["@supabase/supabase-js", "@supabase/supabase-js/**", "@supabase/auth-js", "@supabase/auth-js/**"],
  message: "This file may import @supabase/ssr only. Other @supabase packages stay in store/.",
};

const cryptoBan = {
  group: ["@/lib/crypto", "@/lib/crypto/*", "@/lib/crypto/**"],
  message: "lib/crypto is browser-only. Server code must not import it. The server's own key handling is lib/key-custody.ts.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    // New in eslint-config-next 16: rules written for the React Compiler. The code here predates them
    // and works (an effect that sets today's date after load, a ref read during render), so they are off
    // until they are taken on as their own change, not switched on blind in an upgrade.
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["store/**", "app/(auth)/**", "proxy.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [supabaseBan] }],
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [supabaseBan, storeBan] }],
    },
  },
  {
    files: ["app/(auth)/**/*.{ts,tsx}", "proxy.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [supabaseJsBan, storeBan, cryptoBan] }],
    },
  },
  {
    files: ["services/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
    ignores: ["lib/crypto/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [supabaseBan, cryptoBan] }],
    },
  },
  {
    files: ["app/actions/**/*.{ts,tsx}", "app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [supabaseBan, storeBan, cryptoBan] }],
    },
  },
  {
    files: ["store/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [cryptoBan] }],
    },
  },
]);

export default eslintConfig;
