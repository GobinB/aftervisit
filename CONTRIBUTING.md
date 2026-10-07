# Contributing to AfterVisit

Thanks for helping. AfterVisit does one thing: turn an after-visit summary into a confirmed, shareable care handoff. Changes that keep that flow simple and trustworthy are the most welcome.

## Ground rules

- **One flow.** Upload, review, confirm, share, read. Please do not add features outside it without opening an issue first.
- **The caregiver is in control.** Nothing is shared until a person confirms each item.
- **No medical advice.** AfterVisit restates what the clinician wrote. It never interprets, recommends or warns.
- **Never commit real health information.** Parser fixtures must be fictional or fully de-identified.
- Any new dependency, any new stored field, and any change to the extraction prompt needs a one-line justification in the PR.

## Working on the code

```bash
npm install
cp .env.example .env.local   # fill in Supabase values
npm run dev
npm test                     # parser unit tests (Vitest)
npm run test:e2e             # browser tests (Playwright; needs Supabase)
```

## Improving the parser

The parser lives in `lib/parse`, one module per step. To fix a miss:

1. Add a de-identified fixture to `tests/fixtures/`.
2. Add its expected medications, task count and watch-for count to `tests/parse.test.ts`.
3. Make the test pass without breaking the others. Every source line must still land in exactly one section or in Other notes.

## License

By contributing you agree that your contributions are licensed under the AGPL-3.0.
