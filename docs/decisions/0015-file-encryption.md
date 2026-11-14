# 0015. Files are encrypted in the browser, and All Hands Care keeps the key

## Decision

Saved visit summaries (the photos or the PDF) are the files. They are encrypted in the caregiver's browser before they are uploaded. All Hands Care keeps each circle's key, wrapped, and hands it to the circle's caregiver after Google sign-in. Nobody types or stores recovery words.

**The circle key.** Each circle has one key (AES-GCM, 256 bits) and a `key_version`. A circle starts without one. The first time a key is needed (keeping photos, opening a saved summary, making a helper link), the server makes it (`services/circle-keys.ts`), so there is no "create a key" step.

**How it is stored.** The key is stored on the caregiver's `circle_caregivers` row as `av2.<iv>.<wrapped key>` (migration `0017`). It is wrapped on the server with AES-GCM (`lib/key-custody.ts`). The wrapping key is derived with HKDF-SHA256 from `CIRCLE_KEY_SECRET`, an environment variable that is never written to the database, and from the circle's id. The circle id and the key version are also bound into the wrap. So:

- A copy of the database alone opens nothing: it has wrapped keys and no secret.
- A copy of file storage alone opens nothing: it has ciphertext.
- A stored key copied onto another circle's row does not open there.
- All Hands Care, which has both the database and the secret, is technically able to open saved files. This is not end-to-end encryption. The privacy page says so, and commits that we do not open them except at the caregiver's request or under a valid legal order, telling the caregiver first unless the law forbids it.

If `CIRCLE_KEY_SECRET` is lost or replaced, stored keys no longer open and saved files cannot be recovered by anyone. The server never replaces a key it fails to open.

**Who is handed the key.** Only the circle's caregiver. `openCircleKeyAction` reads the signed-in actor with `getActor`, counts the request against an hourly limit for that account, and the service checks `can(actor, "circle:rotate_key")` before anything is read. The row is then read through the caregiver's own session, so row security checks the same thing again. People with a link are never handed a key by the server. Key bytes are returned to the browser and are not logged.

**In the browser.** `ensureCircleKey` (`components/circles/circle-key.ts`) returns the key with nothing on screen. It keeps a copy in IndexedDB and uses that copy only while it matches the version the server holds. Signing out takes each copy off the device once the server holds that key (`releaseDeviceKeys`); the next sign-in, on any device, is handed the key again. A copy the server cannot be shown to hold stays on the device, because it may be the only one left.

**Files.** Each summary gets its own file key (AES-GCM, 256 bits), made in the browser and wrapped by the circle key. Its row in `visit_documents` stores the wrap, the wrap's IV and `key_version` (migration `0015`). Each page, or the PDF, is encrypted in the browser with the file key and uploaded as a fresh 12-byte IV followed by the ciphertext, to `{circle}/{document}/{n}.enc`. The summary's id and the page number are bound in as additional data, so a page moved to another place does not open. The server refuses a page whose first bytes are a plain JPEG or PDF, and it returns pages still encrypted; the browser unwraps the file key and opens them. A photo or PDF therefore reaches the server only as ciphertext.

A summary saved before `0015` has no key columns. Its files are plain and are served as before.

**Circles that had recovery words.** Before `0017`, the circle key was made in the browser and stored wrapped by 12 recovery words (`av1.600000...`, PBKDF2-SHA256 then AES-GCM), and the server could not open it. Such a circle is moved over without the words where possible:

- A device that still has the key in IndexedDB, at the circle's current version, hands it to the server the next time the caregiver opens the circle there, or signs out there. The server keeps it only if it opens the file key of every saved summary in the circle.
- If nothing was ever saved with the old key, a new key replaces it and nothing is shown.
- Otherwise the caregiver sees one message on Saved visit summaries, on a saved summary, and on the "Keep the photos" step of a visit: the summaries saved before cannot be opened without the old words. It first says to open All Hands Care on the phone or computer where they were saved or opened; "Check again", or coming back to the page, clears the message once that device has handed the key over. "I still have my words" opens the old key in the browser (the words are not sent) and hands the key over. "Start fresh" removes those summaries' files and rows, moves `key_version` forward by one and stores a new key (`reset_own_circle_key`, one transaction). The database refuses it for a circle whose key is held. Medications, reminders, the calendar and summaries saved before `0015` are not touched.

Neither the server nor the device asking can know whether another device still has an old key. So "Start fresh" is never automatic when a saved summary depends on the key: it is a second screen, its button stays off until the caregiver ticks that no other device opens the summaries and the words are gone, and it looks once more for a handed-over key before anything is removed.

The key version moves forward whenever the key is replaced, so a copy left on another device is never mistaken for the current key.

**Helper links** are `/i/{token}#k=...`. The server only creates and stores the token hash. The fragment is not sent to the server. The link page reads `#k=` in the browser, keeps it in the tab, and removes it from the address bar. A link without `#k=` still opens the circle, and making a link never fails because the key could not be had. Saved visit summaries are for the caregiver only, so a helper link has no file to open with the key. The PIN protects server access. It does not wrap or hide the key. Anyone who has a helper link therefore has the circle key. Through the app that opens nothing, but together with a copy of both the database and file storage it would open that circle's saved files.

What this does not cover: the text read from a summary passes through the server to build the draft (it is not saved), and the confirmed medications, reminders and events are stored unencrypted (decision 0007).

## Considered

Keeping the key only in the browser, wrapped by 12 recovery words, which is how this first worked. The server could not open files at all. In use, nobody kept the words: signing out cleared the key from the device, and the next sign-in could not open saved summaries or keep new ones.

Wrapping the key with a database feature (pgsodium or Supabase Vault). The secret would then sit in the same database as the wrapped keys, so one copy of the database would open everything.

## Why

Caregivers here are often older and not technical. A photo they saved has to open when they sign in on a new phone, with nothing to remember. Encrypting in the browser still keeps plain files out of storage and out of the database, and deriving the wrapping key from a secret outside the database means a leak of either one alone exposes no file. The cost is stated plainly: All Hands Care can technically open saved files, so the privacy page no longer says it cannot.
