# 0005. Code versus data, and one project for now

## Decision

Schema is code. Rows are data.

- Tables, policies, and functions live in `supabase/migrations` and run in order. Each file is safe to apply again on a database that already has it, so a new database can be built from the files alone.
- `supabase/seed.sql` is fictional data only. It is the family a local database or a future preview branch starts with. Real families are never written into git.
- This week, production and preview deployments share one Supabase project. The project URL and keys are environment variables. The project ref is not written in the repo, in `supabase/config.toml`, or in the app.
- Before any real family data is stored, preview deployments move to Supabase Branching (Pro plan, GitHub integration). Each pull request preview then gets its own database built from `supabase/migrations` and `supabase/seed.sql`.

We are not adding a second long-lived Supabase project for previews.

## Why

A second project would drift from production and would still be a place real data could land by mistake. Branching builds each preview from the same migrations and the same fictional seed, and it can wait until the schema is what we want to branch.

## What Gobin sets up

Google OAuth clients, the hosted project's Google provider, and the redirect allow-list (`{origin}/callback`) stay in the Supabase and Google dashboards. Those secrets are not committed. `HELPER_SESSION_SECRET`, `SUPABASE_URL`, the anon key, and the service-role key are set in the host's environment for the one project.
