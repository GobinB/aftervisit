# AfterVisit

A permissioned care handoff after every medical visit. A family caregiver uploads (or pastes) an after-visit summary, AfterVisit drafts what changed, what needs to happen next and who needs to act, the caregiver confirms every item, and then shares one clean, read-only page with the people they choose. No accounts. No app install. Nothing is stored until the caregiver chooses to share.

Built for the Assembly Code Incubator (Cohort 02, caregiving). Open source under the [AGPL-3.0](LICENSE). AfterVisit organizes what the clinician wrote; it is not medical advice.

## How it works

1. **Upload**: a PDF, a photo of the printed pages, or pasted text. Or start with the fictional sample visit.
2. **Extract**: a built-in, deterministic parser (`lib/parse`) sorts the text into a visit snapshot, medication changes, next steps, watch-fors and questions. Anything it cannot place is kept under *Other notes*. Nothing is dropped or invented.
3. **Review and confirm**: every item can be edited, deleted or assigned to a person. Unclear items are flagged *Please check this* and must be accepted or edited. Each section is checked off before the handoff can be created.
4. **Share**: add recipients by name and role, optionally a 4-digit PIN, optionally the original document. Copy the link, text it, email it or print it. The creator gets a private manage link.
5. **Read**: recipients open a mobile-first, printable page and tap *I've read this*. The creator sees who read it.

Every handoff expires after 30 days and is deleted automatically.

## Privacy and access (current behavior)

- No accounts. Vercel Web Analytics only (no cookies).
- To build a draft, pasted text and PDFs are sent to AfterVisit's server and processed in memory; photos are read in the browser and only the recognized text is sent. Nothing is saved at this stage.
- When a handoff is created, only the confirmed fields are stored (visit details, medication changes, next steps with assignees, watch-fors, questions, kept notes, each item's source sentence, recipient names and roles, the caregiver's first name). **The full source text is not stored.**
- The original document is stored only if the caregiver turns on *Attach the original summary*, in a private bucket, served through a link that re-checks the handoff on every open, and deleted with the handoff.
- **Access model:** everyone gets the same share link. Anyone who has a link without a PIN can open it. New handoffs are PIN-protected by default (3 wrong tries lock for 10 minutes). Recipient names do not restrict access, and "I've read this" is self-reported.
- Creating a handoff requires confirming the caregiver is the patient or is authorized to share.
- Every handoff expires after 30 days; the creator can delete it any time from the manage link.
- The privacy page reads the active extraction provider from the same code that selects it, so it always names any outside service in use.
- AfterVisit is a prototype and has not completed a privacy, security or HIPAA compliance review. The public demo asks people not to upload real patient records (`NEXT_PUBLIC_DEMO_MODE`, on by default).

## Stack

Next.js 15 (App Router) · TypeScript · React 19 · Tailwind CSS v4 · lucide-react · zod · Supabase Postgres + Storage (server-side, service role only) · unpdf · Tesseract.js · Vercel (hosting, cron, analytics) · Vitest + Playwright.

```
app/                     routes: / · /new · /new/review · /new/share · /h/[token] · /h/[token]/manage · /privacy · /api/*
components/              UI (SectionCard, TaskRow, PinInput, RoleChips, HandoffDocument, ...)
lib/parse/               built-in parser: normalize, header, sections, medications, tasks, watch-for/questions
lib/extract/             ExtractionProvider interface; heuristic (default) and optional LLM provider
lib/                     schema (zod), db, storage, tokens, rate limiting, sample visit
supabase/migrations/     0001_init.sql
tests/                   parser fixtures and Vitest unit tests
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

1. In Supabase, open the SQL editor and run `supabase/migrations/0001_init.sql`. It creates the `handoffs`, `rate_limits` and `handoff_tombstones` tables (RLS on, no policies) and the private `originals` storage bucket.
   With the Supabase CLI instead: `supabase link --project-ref <ref>` then `supabase db push`.
2. Fill in `.env.local`:

| Variable | Notes |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. The anon key is never used. |
| `NEXT_PUBLIC_APP_URL` | Base for share links. Leave unset locally to use the request origin. |
| `HANDOFF_TTL_DAYS` | Default 30 |
| `MAX_UPLOAD_MB` / `NEXT_PUBLIC_MAX_UPLOAD_MB` | Default 10 |
| `CRON_SECRET` | Bearer token Vercel Cron sends to `/api/cron/purge` (`openssl rand -hex 24`) |
| `IP_HASH_SALT` | Salt for IP, PIN and manage-key hashes (`openssl rand -hex 24`) |
| `NEXT_PUBLIC_FEEDBACK_URL` | Optional two-question feedback form shown on the manage page |
| `NEXT_PUBLIC_DEMO_MODE` | Defaults to on; shows "don't upload real patient records" notices. Set to `false` only after a privacy and security review |
| `EXTRACTION_PROVIDER`, `ANTHROPIC_API_KEY`, `EXTRACTION_MODEL` | Optional; leave unset for the built-in parser |

3. Start it:

```bash
npm run dev          # http://localhost:3000
npm test             # parser unit tests
npm run test:e2e     # full browser suite (builds and starts the app on :3005)
```

## How extraction works

The default `heuristic` provider needs no API key and is fully deterministic:

1. **Normalize**: collapse whitespace, fix OCR digit errors in doses (`5O0 mg` to `500 mg`), strip bullets, join lines that wrap mid-sentence.
2. **Visit header**: date, provider (`Name, MD` or `Provider:`), specialty, reason, clinic name, patient first name.
3. **Sections**: headings (short and ending in a colon, ALL CAPS, Epic's `START taking these medications`, and similar) open a section; inline headings like `Call the clinic if: ...` apply to one line.
4. **Classifiers**: medications (dose patterns, verbs for new/stopped/changed/continue, sig abbreviations expanded to plain words), tasks (imperatives and timing phrases, categorized as appointment/referral/lab/pharmacy/home), watch-fors, questions, and a 60-word visit summary from the Assessment or Plan.
5. **Nothing is lost**: every other line goes to *Other notes*, where the caregiver can move it to a section or delete it.

`tests/parse.test.ts` checks six layouts (Epic MyChart, Cerner, an OCR'd printout, an urgent-care sheet, pasted portal text and the sample) and asserts that every source line lands in exactly one place.

An LLM provider can be switched on with `EXTRACTION_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` (`openai` and `gemini` are reserved names and currently fall back to the built-in parser). It uses structured output validated with zod and falls back to the built-in parser on any error. If you enable it, update the privacy page to name the provider.

## Deploying to Vercel

1. Import the GitHub repo in Vercel; the framework is detected automatically.
2. Run the migration in Supabase (above).
3. Add the environment variables for Production and Preview.
4. `vercel.json` schedules `/api/cron/purge` daily at 03:00 UTC.
5. Enable Web Analytics. Turn on Deployment Protection for previews only.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please never attach real patient documents to issues.

## License

Copyright (C) 2026 Gobin Bastola. Licensed under the GNU Affero General Public License v3.0. If you run a modified version as a network service, you must offer its source code to its users.
