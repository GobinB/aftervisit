# 0008. Voice lookup reads the list. It never writes medical content

## Decision

A caregiver or helper can tap the mic and ask, for example, "What medications should I give today?" The answer is read word for word from the circle's own records.

- The browser turns speech into text with the Web Speech API (Chrome, Edge and Safari). Other browsers get a typed box.
- Plain code matches the text to a fixed set of lookups: today's medications, my tasks, and later the next appointment. No language model is involved.
- Before answering, the screen shows "I heard: ..." so the person can see what was understood.
- The answer is shown and spoken with its "as of" date, for example "Margaret's medication list as of November 20: ...".
- Questions that match no lookup are counted, never stored as text, so we can see how often voice mishears.
- It does not track doses, say whether a dose was given, or answer anything outside the fixed set.
- AfterVisit stores no audio. The browser's speech service (Google in Chrome, Apple in Safari) turns speech into text, so the words leave the phone. The privacy page says so, and the mic is off until tapped.

## Why

Hands are often full when medications are handed out, so reading the list aloud helps. Software that writes or interprets medical content is a different product with different risks. A fixed lookup that reads back what a person entered keeps that line clear.
