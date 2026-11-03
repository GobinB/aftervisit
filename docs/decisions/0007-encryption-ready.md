# 0007. Medical content is shaped for encryption

## Decision

In V1, files, photos and handoff originals are encrypted in the browser (decision 0015). Other medical content is not encrypted yet, but it is stored so that V2 can encrypt it without a redesign.

- Each medical record keeps its contents in one `content jsonb` column. Plain columns hold only what the server needs to route and permit: ids, `circle_id`, kind, status, dates and owner.
- Inside `content`: medication names, doses and instructions, change history, task titles and notes, post text, event titles and notes, document titles, and handoff contents.
- Plain columns on purpose, because they are not medical and the server needs them: helper names, roles and optional emails, the caregiver's Google name and email, consent records, statuses, dates and ids.
- `content` is checked with zod in `services/` before it is written, because Postgres will not be able to see inside it once it is encrypted.
- Sorting and searching medical text happens in the app after reading, not in SQL.
- In V2, `content` becomes `content_enc`, encrypted with the circle key that already protects files.

## Why

Encrypting everything in V1 would delay the first release. Shaping the data now means V2 encryption is a change to one column per table, not a rewrite. The privacy page says plainly what is and is not end-to-end encrypted today.
