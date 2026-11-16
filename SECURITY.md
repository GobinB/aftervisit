# Security

All Hands Care holds care information about older adults: medicines, appointments, allergies and notes from visits. We take
reports about its security seriously and are grateful for them.

## Reporting a problem

Email **admin@allhandscare.org** with:

- what you found and where (a page, an address on allhandscare.org, or a file in this repository)
- the steps to see it, using your own account and your own test circle
- what someone could do with it

Please do not open a public issue for a security problem, and give us a reasonable time to fix it before you talk about it in
public.

We will:

- reply within 3 business days
- keep you told how the fix is going
- thank you by name when it is fixed, if you would like that

## Testing safely

What is in scope: the live site at allhandscare.org and the code in this repository.

When you test:

- Use only your own Google account and circles you made yourself. Never open, change or keep a real family's information. If you
  reach any by mistake, stop, do not keep a copy, and tell us.
- Do not try to slow down or take down the site, send automated floods of requests, or test the companies we use (Vercel,
  Supabase, Google, OpenAI) beyond what their own rules allow.
- Do not try to trick the people who run All Hands Care or the families who use it.

If you follow these rules in good faith, we will not take legal action against you for your research.

## Which version

Only the newest version is supported: the `main` branch, which is what runs on allhandscare.org.

## If information is exposed

If someone who should not have seen information in All Hands Care may have seen it, this is what we do:

1. **Stop it.** Close the gap, and change any key or secret that may have been seen: the database keys, the OpenAI key and the
   Google sign-in secret. Make new links for any person whose link may have been seen. Saved photos and PDFs are locked with file
   keys that are themselves locked with `CIRCLE_KEY_SECRET`, which is kept apart from the database: if the secret and the database
   may both have been seen, treat the saved files as seen too.
2. **Find out what happened.** Which circles, which information, which people, and when, using the database's activity records
   and the hosting logs. Write it down as we go.
3. **Tell the caregivers affected**, by email to their Google address, as soon as we can and no later than 60 days after we learn
   of it: what happened, what information, what we have done, and what they can do. The privacy page promises this.
4. **Tell anyone the law requires us to.** All Hands Care is a consumer health app, so the Federal Trade Commission's Health
   Breach Notification Rule may apply: when it does, the FTC is told within the time the rule sets, and for 500 or more people
   in one state, the media there too. Some states have their own breach notice laws.
5. **Learn from it.** Fix the cause, add a test that would have caught it, and note what changed in `CHANGELOG.md`.
