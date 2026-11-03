# 0001. Four layers, one direction

## Decision

Every request moves through the same four layers, in one direction:

1. `app/` and `components/` render screens. Forms call a server action.
2. `app/actions/` checks the input with zod, gets the actor with `getActor()`, and calls one service.
3. `services/` holds the rules. It calls `can()` from `lib/permissions.ts` before it reads or writes anything.
4. `store/` is the only code that talks to Supabase. It never decides permissions.

`app/api/` is kept only for things that need a real URL: file downloads, the cron job, and webhooks.

ESLint enforces the direction with `no-restricted-imports` (`eslint.config.mjs`):

- Only `store/` imports `@supabase/supabase-js`. `app/(auth)/` and `middleware.ts` may use `@supabase/ssr` for the session.
- `app/` and `components/` never import `store/`.
- `lib/crypto/` runs in the browser only. Server code (`services/`, `store/`, actions, API routes, `app/(auth)/`) cannot import it.
- Files that read secrets start with `import "server-only"`.

New code goes into these folders from the first week. Prototype files move when they are next touched.

## Considered

Keeping the prototype layout, where API routes read the database directly. It works for one feature, but every new feature would repeat its own permission checks.

## Why

When there is one place for each job, a permission check cannot be skipped by accident, and a reviewer knows where to look. The import rules make the direction a build error instead of a convention.
