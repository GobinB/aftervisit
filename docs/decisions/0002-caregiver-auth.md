# 0002. Caregivers sign in with Google

## Decision

Caregivers sign in with Google through Supabase Auth. It is the only sign-in method in V1, and AfterVisit sends no email or text messages.

- The login page has one button. It calls `signInWithOAuth({ provider: "google" })` with `redirectTo` set to the site's own `/callback`.
- `app/(auth)/callback` exchanges the code for a session cookie with `@supabase/ssr`. `middleware.ts` keeps the session fresh.
- The `next` address a person returns to after sign-in is checked by `lib/safe-next.ts`. Only a path on this site is allowed.
- Scopes are the defaults only: `openid`, `email`, `profile`. AfterVisit never asks for Gmail, Drive or Calendar access.
- Email sign-in stays off in the Supabase dashboard, so nothing depends on Supabase's built-in test mailer.
- The signed-in user's id becomes `circles.owner_id`.

The Google OAuth clients, the hosted provider settings and the redirect allow-list live in the Google and Supabase dashboards. Their secrets are never committed. Local development uses a separate Google client read by `supabase/config.toml`.

## Considered

- Email magic links. They need an email provider to send mail reliably, which a small open-source project would have to run and pay for.
- Passwords. They need resets, which also need email.
- Sign in with Apple. It needs a paid Apple developer membership.

## Why

Most family caregivers already have a Google account on their phone, so there is nothing new to remember. If pilot families turn out not to have one, we add another option then and record it as a new decision.
