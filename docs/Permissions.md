# Permissions

`can(actor, action, subject)` in `lib/permissions.ts` is default deny. The grid is `GRID`. `tests/unit/permissions.test.ts` walks every role and every action. Adding a role or an action without a cell fails that test.

Roles: owner, family, care manager, home aide, day program. Each circle has exactly one caregiver who signs in, its owner; the database allows one caregiver row per circle.

To-dos: the owner adds, edits, assigns and deletes. Family and care managers see every to-do; home aides and day programs see only the ones given to them. Family can take a to-do nobody has ("I'll do it"). Each helper can mark only their own to-dos done. Helpers act through the server, which checks `can()` before every write and limits the update to their own row.

Medications: every helper role can read and print the list unless the caregiver hides it for that person; only the owner adds, edits, stops or restarts, and only the owner sees the change history (`medication_changes`, written by a database trigger).

Only the owner can rotate the circle key (`circle:rotate_key`). That writes the new wrapped key only on the owner's row. Helpers cannot rotate the key. Family can read and post updates, including family-only ones. A care manager can read updates that are not family-only. Home aides and day programs do not see updates. They can read and print medications, see their own tasks, read the calendar, and open the care folder of documents. Handoff sections for helpers are only the ones chosen on their member row. Per-member `visibility` can hide an area. It cannot grant manage, export, or delete.

## Who is locked by what

`getActor(circleId)` is the only code that reads cookies and auth headers.

- A caregiver gets their Supabase access token on the actor. `clientFor(actor)` uses that token, so row-level security applies. Policies allow a caregiver to see a circle only when `circle_caregivers` has their user id. Being the `owner_id` is not enough. Only the owner may delete a circle, add or remove caregivers, or change caregiver roles. A normal update cannot change `owner_id` or grant the owner role. Each caregiver can write only their own wrapped circle key. Consents and activity are insert-only for signed-in users.
- A helper cookie is an HMAC (`HELPER_SESSION_SECRET`) of member id, circle id, and role. One browser can hold several circles. On every request the member row is loaded again: it must exist, `revoked_at` must be null, `expires_at` must be in the future, and the role is the one on the row. `last_seen_at` moves at most once a minute, and that same update pushes `expires_at` out 90 days.
- Helpers use the service-role client, which bypasses row-level security. `can()` is the only lock on that path. Services call `can()` before `store/`. Do not query `store/` from `app/` or `components/`.

The handoff demo still uses the service role directly, as it did before circles. Those routes are not circle actors.

Opening a member link (`app/actions/enter.ts`) has no actor yet. It checks the member row and the per-link PIN (`try_pin`, which still serves handoff recipients too), then sets the cookie. After that, pages call `getActor`.

## Sharing a link

The app does not send email or text. The members screen copies the link, opens the device share sheet, or builds a `mailto:` link for the person's own mail app. The link is shown once. A new link replaces the hash.
