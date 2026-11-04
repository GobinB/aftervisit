# 0003. Helpers use personal links, not accounts

## Decision

Family members, home aides, day programs and care managers do not create accounts. Each one gets a personal link.

- Adding a helper creates a `members` row with a random 24-character token. Only a salted SHA-256 hash of the token is stored (`hashInvite` in `lib/invites.ts`).
- The caregiver sends the link from their own phone: copy, the share sheet, or a `mailto:` link that opens their own mail app. All Hands Care never sends a message itself.
- `/i/{token}` hashes the token, finds the row and checks the PIN if one is set. Wrong PINs lock that one link, decided in the database by `try_pin`. Then it sets a signed cookie (HMAC with `HELPER_SESSION_SECRET`) with the member id, circle id and role.
- The cookie only says who the person claims to be. The member row is checked again on every request: it exists, it is not revoked, it has not expired, and its current role and visibility apply.
- At most once a minute, a visit updates `last_seen_at` and moves `expires_at` 90 days ahead. A link nobody opens for 90 days stops working.
- One browser can hold sessions for several circles, for an aide who helps two families.
- The path stays `/i/{token}`, so older handoff links keep working.
- Helper links carry the circle key after `#` (`/i/{token}#k=...`). The caregiver's browser builds the link, and the part after `#` is never sent to the server (decision 0015).

## Considered

Accounts for helpers. Many helpers are aides or day program staff who will not create an account for each family.

## Why

A link is the lowest-effort way for someone to see what they need. The risk is forwarding, so each link is personal, revocable, can have a PIN, expires, and shows the caregiver when it was last opened.
