# Contributing to All Hands Care

Thanks for helping. All Hands Care is one shared care page for the person you look after: one caregiver signs in, and everyone else gets their own link. Changes that keep it simple and trustworthy are the most welcome.

## Ground rules

- **Few words, big targets.** Every screen should work for a tired caregiver on a phone. Please open an issue before adding a new area.
- **The caregiver is in control.** Nothing is shared until a person confirms each item.
- **No medical advice.** All Hands Care restates what the clinician wrote. It never interprets, recommends or warns.
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
2. Add its expected medications, task count and watch-for count to `tests/unit/parse.test.ts`.
3. Make the test pass without breaking the others. Every source line must still land in exactly one section or in Other notes.

## License

By contributing you agree that your contributions are licensed under the AGPL-3.0.
