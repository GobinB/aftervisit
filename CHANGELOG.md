# Changelog

Notable changes to AfterVisit. The newest entries are at the top.

## Unreleased

- Each circle has its own pages for Overview, Care summary, People and Settings, with tabs between them and a getting-started checklist for the owner. Starting a circle is four short steps. The home page shows the People and Care summary modules using the app's own screens with fictional data.
- Deleting a circle works, and it turns off every helper link in the same step. Caregivers can sign out from circle screens, which also removes this device's circle keys. A Google sign-in that times out shows a message on the sign-in page. The add-person picker lists only the areas a helper can see today.
- The home page describes the care circle, with "Start a care circle" and a "Sign in" link in the app bar. The sample visit still needs no sign-in. The new-circle form asks who you are caring for and no longer fills in your own name.
- Encrypt files in the browser. Each circle key is wrapped with a recovery phrase, and helper links carry the key after # so the server never sees it. Only the owner can rotate that key, and the new helper links are saved in the same step.
- A signed-in caregiver can create a circle. The circle, the owner row, consent, and the activity note are saved in one step.
- Strip share tokens, invite tokens, query strings, and hashes from Vercel Web Analytics before they are sent.
- Add circles, caregiver Google sign-in, helper links, and role permissions. Ownership stays with the owner in the database, and sign-in returns only to this site. The public demo and existing handoff links stay as they are.
- Add CI (lint, typecheck, unit tests, production build), weekly CodeQL, and Dependabot updates grouped by minor/patch and major. Runs on `main` always finish; only a newer push to the same pull request cancels a run.
- Close the critical Next.js advisories and the high Zod and PostCSS advisories (next 15.5.28, zod 4.6.7, PostCSS 8.5.29).
