# 0004. Database access: row security for caregivers, permissions.ts for helpers

## Decision

There are two paths to the database, and `store/db.ts` picks one with `clientFor(actor)`.

- **Caregivers** query with their own Supabase token (`userClient`). Postgres row-level security applies, so a caregiver can only reach circles they belong to, whatever the app code does. Writes that need several rows to change together, such as creating a circle or changing the circle key, are Postgres functions (`create_circle`, `rotate_own_circle_key`).
- **Helpers** have no Supabase account, so their requests use the service role (`serviceClient`), which skips row security. On this path `can()` in `lib/permissions.ts` is the only lock. `docs/Permissions.md` says so plainly.

Every table has row security turned on. `supabase/tests/` checks in CI that one circle can never read another's rows, and that a co-caregiver cannot take over a circle or change its key.

## Considered

- The service role for everyone. Simpler, but then a single missed check in app code exposes every family.
- Short-lived tokens minted for each helper request, so row security covers helpers too. Not built: it depends on whether the project's Supabase key setup allows minting them.

## Why

Caregivers can do the most, so they get the strongest lock: the database itself. Helpers can do less, and their path is short and covered by the permissions grid test (`tests/unit/permissions.test.ts`).
