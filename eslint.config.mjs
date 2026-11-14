import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const storeBan = {
  group: ["@/store", "@/store/*", "@/store/**"],
  message: "app/ and components/ never import from store/. Call a service or a server action.",
};

const supabaseBan = {
  group: ["@supabase/*", "@supabase/**"],
  message: "Only store/ may import @supabase packages. app/(auth) and middleware.ts may import @supabase/ssr.",
};

const supabaseJsBan = {
  group: ["@supabase/supabase-js", "@supabase/supabase-js/**", "@supabase/auth-js", "@supabase/auth-js/**"],
  message: "This file may import @supabase/ssr only. Other @supabase packages stay in store/.",
};

const cryptoBan = {
  group: ["@/lib/crypto", "@/lib/crypto/*", "@/lib/crypto/**"],
  message: "lib/crypto is browser-only. Server code must not import it. The server's own key handling is lib/key-custody.ts.",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["store/**", "app/(auth)/**", "middleware.ts"],
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
    files: ["app/(auth)/**/*.{ts,tsx}", "middleware.ts"],
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
];

export default eslintConfig;
