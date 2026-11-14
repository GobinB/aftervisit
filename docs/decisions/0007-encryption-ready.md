# 0007. Medical content is shaped for encryption

## Decision

Saved visit summaries are encrypted in the browser with the circle key, which All Hands Care keeps (decision 0015). Other medical content is not encrypted, but it is stored so that encrypting it later needs no redesign.

- Each medical record keeps its contents in one `content jsonb` column. Plain columns hold only what the server needs to route and permit: ids, `circle_id`, kind, status, dates and owner.
- Today that is `circles.content`: the person's name, allergies, doctors, pharmacy and emergency contacts. New medical tables follow the same rule.
- Plain columns on purpose, because they are not medical and the server needs them: helper names, roles and optional emails, the caregiver's Google name and email, consent records, statuses, dates and ids.
- `content` is checked with zod in `services/` before it is written, because Postgres will not be able to see inside it once it is encrypted.
- Sorting and searching medical text happens in the app after reading, not in SQL.
- Planned, not built: `content` becomes `content_enc`, encrypted with the circle key.

## Why

Shaping the data now means encrypting it later is a change to one column per table, not a rewrite. The privacy page says plainly what is encrypted today and what All Hands Care can read.
