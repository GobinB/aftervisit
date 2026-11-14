# 0003. Helpers use personal links, not accounts

## Decision

Family members, home aides, day programs and care managers do not create accounts. Each one gets a personal link.

- Each helper has one link that keeps working. Its 24-character token is worked out on the server from the person's id and a link number (`link_version`), keyed by `HELPER_SESSION_SECRET` (`lib/member-token.ts`), so the caregiver can share the same link again from any device. Only a salted SHA-256 hash of the token is stored (`hashInvite` in `lib/invites.ts`). "New link" moves the number up: the old link stops working and every device that opened it is signed out. Anyone with `HELPER_SESSION_SECRET` could already sign a helper cookie, so working tokens out from it adds no new way in; changing it changes every link.
- The caregiver sends the link from their own phone: copy, the share sheet, or a `mailto:` link that opens their own mail app. All Hands Care never sends a message itself.
- `/i/{token}` hashes the token, finds the row and checks the PIN if one is set. Wrong PINs lock that one link, decided in the database by `try_pin`. Then it sets a signed cookie (HMAC with `HELPER_SESSION_SECRET`) with the member id, circle id and role.
- The cookie only says who the person claims to be. The member row is checked again on every request: it exists, it is not revoked, it has not expired, and its current role and visibility apply.
- A link stops working 30 days after it was last opened (or made), and always 90 days after it was made (`lib/link-life.ts`; the database refuses an `expires_at` later than `link_issued_at` plus 90 days). At most once a minute, a visit updates `last_seen_at` and moves `expires_at` within those limits. Today lists links ending within two weeks, and "New link" sends a fresh one.
- A PIN is optional and off unless the caregiver sets one. It is kept only as a hash; sharing the same link again reminds the person to use their PIN rather than showing it.
- When the caregiver changes medicines, the calendar, reminders or the care summary, by hand or from a visit summary, a trigger records the area and time in `circle_updates` (only for changes made in the caregiver's own session). Each circle page then lists the people who can see that area and have not opened their link, been sent it, or been given it since, with a button to send each one their same link and a note saying what changed (`components/circles/ShareUpdates.tsx`). Sending, copying or "Skip this time" sets `last_told_at`.
- One browser can hold sessions for several circles, for an aide who helps two families.
- The path stays `/i/{token}`, so older handoff links keep working.
- A link is `/i/{token}` and nothing else. Links made before November 14, 2026 carried the circle key after `#k=`; the link page still removes anything after `#` from the address bar and ignores it.

## Considered

Accounts for helpers. Many helpers are aides or day program staff who will not create an account for each family.

A new link (and PIN) after every visit. It cuts off a leaked link sooner, but only at the next visit, and it breaks every helper's saved link and signs out their phone each time. The 30- and 90-day limits, turning a link off, and "New link" cover a leak without that.

A PIN written into the link. A PIN only helps because it travels apart from the link; inside it, it protects nothing.

## Why

A link is the lowest-effort way for someone to see what they need. The risk is forwarding, so each link is personal, revocable, can have a PIN, expires, and shows the caregiver when it was last opened.
