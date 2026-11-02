# Changelog

Notable changes to AfterVisit. The newest entries are at the top.

## Unreleased

- Encrypt files in the browser. Each circle key is wrapped with a recovery phrase, and helper links carry the key after # so the server never sees it.
- Add circles, caregiver Google sign-in, helper links, and role permissions. Ownership stays with the owner in the database, and sign-in returns only to this site. The public demo and existing handoff links stay as they are.
- Add CI (lint, typecheck, unit tests, production build), weekly CodeQL, and Dependabot updates grouped by minor/patch and major. Runs on `main` always finish; only a newer push to the same pull request cancels a run.
- Close the critical Next.js advisories and the high Zod and PostCSS advisories (next 15.5.28, zod 4.6.7, PostCSS 8.5.29).
