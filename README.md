# AfterVisit

A permissioned care handoff after every medical visit. A family caregiver uploads (or pastes) an after-visit summary, reviews what changed and assigns the next steps, then gives family members and professional caregivers their own revocable links with individual section visibility. Recipients acknowledge the handoff and update their steps; the caregiver follows progress from a private dashboard. No accounts. No app install. Nothing is stored until the caregiver chooses to share.

Built for the Assembly Code Incubator (Cohort 02, caregiving). Open source under the [AGPL-3.0](LICENSE). AfterVisit organizes what the clinician wrote; it is not medical advice.

## How it works

1. **Upload**: a PDF, a photo of the printed pages, or pasted text. Or start with the fictional sample visit.
2. **Extract**: a built-in, deterministic parser (`lib/parse`) sorts the text into a visit snapshot, medication changes, next steps, watch-fors and questions. Anything it cannot place is kept under *Other notes*. Nothing is dropped or invented.
3. **Review and confirm**: every item can be edited, deleted or assigned to a person. Unclear items are flagged *Please check this* and must be accepted or edited. Each section is checked off before the handoff can be created.
4. **Share**: add recipients by name and role, choose each person's visible sections and task scope, and confirm permission to share. A 4-digit PIN is enabled by default; attaching the original document is optional. Each recipient gets a personal link, and the creator gets a private manage link.
5. **Coordinate**: recipients open a mobile-first, printable page, tap *I've read this*, and update permitted steps with a status and optional note. The creator's dashboard shows self-reported acknowledgments, task progress and activity, and can revoke individual links or delete the handoff.

Every handoff expires after 30 days and is deleted automatically.

## Privacy and access (current behavior)

The public demo (`/new`, `/h/...`, `/i/...` handoff links) is unchanged: no account is required to build or open a handoff.

Circles are the signed-in product. A caregiver signs in with Google. A helper opens a personal link (`/i/...`), which can be the same shape as an older handoff invite. The server tells them apart by the stored hash. Helper browsers can stay signed into more than one circle. See [docs/Permissions.md](docs/Permissions.md).

- Handoff demo: no account. Vercel Web Analytics only on marketing pages.
- To build a draft, pasted text and PDFs are sent to AfterVisit's server and processed in memory; photos are read in the browser and only the recognized text is sent. Nothing is saved at this stage.
- When a handoff is created, only the confirmed fields are stored (visit details, medication changes, next steps with assignees, watch-fors, questions, kept notes, each item's source sentence, recipient names and roles, the caregiver's first name). **The full source text is not stored.**
- The original document is stored only if the caregiver turns on *Attach the original summary*, in a private bucket, served through a link that re-checks the handoff on every open, and deleted with the handoff.
- **Access model:** each person gets their own revocable link (`/i/[invite]`, stored only as a hash) and sees only the sections the caregiver chose, filtered on the server. Anyone who has a person's link can open it if there is no PIN; new handoffs are PIN-protected by default. 3 wrong tries lock that one link for 10 minutes, each later lock doubles, and the third stays until the caregiver unlocks it from the manage page; one person's wrong tries never lock anyone else out. Each attempt is decided in one locked database step, so guesses sent at the same time cannot get past the limit. Acknowledgments and step updates are recorded against the personal link used, which shows which link was used, not who held the phone. Handoffs created before personal links used one shared link, where read receipts were a typed name.
- **Next steps** have a status (not started, in progress, completed) with notes and attribution. People can update only their own steps; the caregiver can update any from the manage page, which also shows the handoff at a glance and an activity log.
- **Feedback** from the demo and manage page is stored anonymously (no handoff link, no IP).
- Creating a handoff requires confirming the caregiver is the patient or is authorized to share.
- Every handoff expires after 30 days; the creator can delete it any time from the manage link.
- The privacy page reads the active extraction provider from the same code that selects it, so it always names any outside service in use.
- AfterVisit is a prototype and has not completed a privacy, security or HIPAA compliance review. The public demo asks people not to upload real patient records (`NEXT_PUBLIC_DEMO_MODE`, on by default).

## Stack

Next.js 15 (App Router) · TypeScript · React 19 · Tailwind CSS v4 · lucide-react · zod · Supabase Postgres + Storage · unpdf · Tesseract.js · Vercel (hosting, cron, analytics) · Vitest + Playwright.

```
app/                     routes, server actions, Google sign-in
components/ui/           Button, Badge, Switch, Toast, PinInput
services/                circles and members. Each call checks can() before store/
store/                   the only folder that imports @supabase (plus auth routes and middleware, which use @supabase/ssr)
lib/                     actor, permissions, schema, parser
supabase/migrations/     0001 through 0004. Seed data is fictional, in supabase/seed.sql
tests/unit/              Vitest, including the permissions grid
supabase/tests/          pgTAP row-level security
e2e/                     Playwright tests (desktop Chrome, iPhone Safari, Android Chrome)
```

## Run it locally (about 10 minutes)

Requirements: Node 20+ and a free Supabase project.

```bash
git clone https://github.com/GobinB/aftervisit.git
cd aftervisit
npm install
cp .env.example .env.local
```

1. Apply every migration in order, including `supabase/migrations/0004_circles_members.sql`, `supabase/migrations/0005_create_circle.sql`, and `supabase/migrations/0006_circle_key_guard.sql`. With the Supabase CLI: `supabase link` (the project ref stays on your machine, not in git) then `supabase db push`. `supabase/seed.sql` loads a fictional family and is what a preview branch will run. Do not put real family data in it.
2. Fill in `.env.local`. Today, production and preview deployments share one Supabase project. The URL and keys are environment variables only. Planned: preview deployments move to Supabase Branching so each pull request gets its own database from the migrations and the seed. See [docs/decisions/0005-code-vs-data.md](docs/decisions/0005-code-vs-data.md).

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | Project URL from the Supabase settings page |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key. Google sign-in and a caregiver's own session (row-level security) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Existing handoff routes, and helper sessions. Bypasses row-level security; helper access is checked in `lib/permissions.ts` |
| `HELPER_SESSION_SECRET` | HMAC key for helper-link cookies (`openssl rand -hex 32`) |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | Google client. Read by `supabase/config.toml` for local auth. Hosted Google settings are in the Supabase dashboard |
| `NEXT_PUBLIC_APP_URL` | Base for share links and the Google redirect (`{origin}/callback`). Leave unset locally to use the request origin |
| `HANDOFF_TTL_DAYS` | Default 30 |
| `MAX_UPLOAD_MB` / `NEXT_PUBLIC_MAX_UPLOAD_MB` | Default 10 |
| `CRON_SECRET` | Bearer token Vercel Cron sends to `/api/cron/purge` (`openssl rand -hex 24`) |
| `IP_HASH_SALT` | Salt for IP, PIN, invite, and manage-key hashes (`openssl rand -hex 24`) |
| `NEXT_PUBLIC_FEEDBACK_URL` | Optional two-question feedback form shown on the manage page |
| `NEXT_PUBLIC_DEMO_MODE` | Defaults to on; shows "don't upload real patient records" notices. Set to `false` only after a privacy and security review |
| `EXTRACTION_PROVIDER`, `ANTHROPIC_API_KEY`, `EXTRACTION_MODEL` | Optional; leave unset for the built-in parser |

3. Start it:

```bash
npm run dev          # http://localhost:3000
npm test             # parser, permissions grid, and invitation unit tests
npm run test:e2e     # full browser suite (builds and starts the app on :3005)
```

## How extraction works

The default `heuristic` provider needs no API key and is fully deterministic:

1. **Normalize**: collapse whitespace, fix OCR digit errors in doses (`5O0 mg` to `500 mg`), strip bullets, join lines that wrap mid-sentence.
2. **Visit header**: date, provider (`Name, MD` or `Provider:`), specialty, reason, clinic name, patient first name.
3. **Sections**: headings (short and ending in a colon, ALL CAPS, Epic's `START taking these medications`, and similar) open a section; inline headings like `Call the clinic if: ...` apply to one line.
4. **Classifiers**: medications (dose patterns, verbs for new/stopped/changed/continue, sig abbreviations expanded to plain words), tasks (imperatives and timing phrases, categorized as appointment/referral/lab/pharmacy/home), watch-fors, questions, and a 60-word visit summary from the Assessment or Plan.
5. **Nothing is lost**: every other line goes to *Other notes*, where the caregiver can move it to a section or delete it.

`tests/unit/parse.test.ts` checks six layouts (Epic MyChart, Cerner, an OCR'd printout, an urgent-care sheet, pasted portal text and the sample) and asserts that every source line lands in exactly one place.

An LLM provider can be switched on with `EXTRACTION_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` (`openai` and `gemini` are reserved names and currently fall back to the built-in parser). It uses structured output validated with zod and falls back to the built-in parser on any error. The privacy page automatically discloses the configured provider.

## Deploying to Vercel

1. Import the GitHub repo in Vercel; the framework is detected automatically.
2. Apply every Supabase migration (above) to the production database before deploying, including `0004_circles_members.sql`, `0005_create_circle.sql`, and `0006_circle_key_guard.sql`. Personal links, task tracking and feedback require `0002_invites_tracking.sql`; PIN checks require `0003_pin_lockout.sql` and fail without it. Circles require `0004`. Creating a circle requires `0005`. File keys require `0006`. Set `HELPER_SESSION_SECRET` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` on the one shared project. Add `{origin}/callback` to the Google redirect allow-list.
3. Add the environment variables for Production and Preview.
4. `vercel.json` schedules `/api/cron/purge` daily at 03:00 UTC.
5. Enable Web Analytics. Turn on Deployment Protection for previews only.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please never attach real patient documents to issues.

## License

Copyright (C) 2026 Gobin Bastola. Licensed under the GNU Affero General Public License v3.0. If you run a modified version as a network service, you must offer its source code to its users.
