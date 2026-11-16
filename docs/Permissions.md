# Permissions

`can(actor, action, subject)` in `lib/permissions.ts` is default deny. The grid is `GRID`. `tests/unit/permissions.test.ts` walks every role and every action. Adding a role or an action without a cell fails that test.

Roles: owner, family, care manager, home aide, day program. Each circle has exactly one caregiver who signs in, its owner; the database allows one caregiver row per circle.

Calendar: everyone with the area can read it. The owner and family add and edit events and can say "I'll go" on one that needs someone; care managers, home aides and day programs only read. Only the owner deletes events.

To-dos: the owner adds, edits, assigns and deletes. Family and care managers see every to-do; home aides and day programs see only the ones given to them. Family can take a to-do nobody has ("I'll do it"). Each helper can mark only their own to-dos done. Helpers act through the server, which checks `can()` before every write and limits the update to their own row.

Medications: every helper role can read and print the list unless the caregiver hides it for that person; only the owner adds, edits, stops or restarts, and only the owner sees the change history (`medication_changes`, written by a database trigger).

Visit notes (`visits`, what an after-visit summary says besides medicines, reminders and appointments): every helper role reads what to watch for and good to know (`visits:read`); the short summary, the reason for the visit and the questions for the next visit reach only the owner, family and care managers (`visits:read:summary`), and are left out of what a home aide or day program is sent, not just hidden on the screen. Only the owner changes or deletes them (`visits:edit`), and only the owner sees the kept photos. The caregiver can hide visit notes from one person (the `handoff` area); a person who already had medicines or the care summary hidden had visit notes hidden when they were introduced.

Phone numbers and the Emergency page: everyone in the circle can open the Emergency page (`emergency:read`), and each part of it follows the action that already shows it. Emergency contacts and allergies come from the care summary, so they need `summary:read` and go when the caregiver hides the care summary from someone. A person's phone number is shown wherever that person is: on the People list and the Emergency page, to whoever has `members:read` (the owner, family and care managers). The caregiver's number is shown to whoever has `members:read:caregivers` (every role). The number of someone whose link was turned off is shown only to the owner. Only the owner adds or changes other people's numbers (`members:manage`). Anyone can set or remove their own (`phone:edit:own`): the owner on their caregiver row, a person with a link on their own member row only, through the server.

Only the owner is handed the circle's key for files (`circle:rotate_key`). The key is stored, wrapped, only on the owner's row, and nothing can replace it. The server never hands it to a helper. Family can read and post updates, including family-only ones. A care manager can read updates that are not family-only. Home aides and day programs do not see updates. They can read and print medications, see their own tasks, read the calendar, and open the care folder of documents. Handoff sections for helpers are only the ones chosen on their member row. Per-member `visibility` can hide an area. It cannot grant manage, export, or delete.

## Who is locked by what

`getActor(circleId)` is the only code that reads cookies and auth headers.

- A caregiver gets their Supabase access token on the actor. `clientFor(actor)` uses that token, so row-level security applies. Policies allow a caregiver to see a circle only when `circle_caregivers` has their user id. Being the `owner_id` is not enough. Only the owner may delete a circle, add or remove caregivers, or change caregiver roles. A normal update cannot change `owner_id` or grant the owner role. Each caregiver can write only their own wrapped circle key. Consents and activity are insert-only for signed-in users.
- A helper cookie is an HMAC (`HELPER_SESSION_SECRET`) of member id, circle id, and role. One browser can hold several circles. On every request the member row is loaded again: it must exist, `revoked_at` must be null, `expires_at` must be in the future, and the role is the one on the row. `last_seen_at` moves at most once a minute, and that same update pushes `expires_at` out 90 days.
- Helpers use the service-role client, which bypasses row-level security. `can()` is the only lock on that path. Services call `can()` before `store/`. Do not query `store/` from `app/` or `components/`.

The handoff demo still uses the service role directly, as it did before circles. Those routes are not circle actors.

Opening a member link (`app/actions/enter.ts`) has no actor yet. It checks the member row and the per-link PIN (`try_pin`, which still serves handoff recipients too), then sets the cookie. After that, pages call `getActor`.

## Sharing a link

The app does not send email or text. The members screen copies the link, opens the device share sheet, or builds a `mailto:` link for the person's own mail app. The caregiver can share the same link again at any time (decision 0003). A new link replaces the hash and signs out every device that opened the old one.
