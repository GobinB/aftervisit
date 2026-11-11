# 0015. File keys stay in the browser

## Decision

Each circle can have one key. It is made only when the caregiver chooses to, under Settings → Key for files; starting a circle and adding people do not need it. Keeping the photos or PDF of a visit summary does: the screen that keeps them asks for the key if this device does not have it. The caregiver's browser creates it with Web Crypto (AES-GCM, 256 bits). The server stores only a wrapped copy on that caregiver's `circle_caregivers` row, plus `key_version`. It never receives the raw key or the recovery phrase.

The recovery phrase is 12 BIP39 English words (128 bits plus a checksum). It is shown once, when the key is made, and the person types three of the words before continuing. The screen says that if the words are lost, files cannot be recovered. The browser derives a wrapping key with PBKDF2-SHA256, 600,000 iterations, a random 16-byte salt, and AES-GCM. Web Crypto provides PBKDF2. Argon2 and scrypt are not in the browser API, and a WASM library would be a new dependency. 600,000 iterations is the OWASP 2023 minimum for PBKDF2-SHA256, which makes guessing a 12-word phrase impractical. The salt, IV, and ciphertext travel inside `circle_key_wrapped` (`av1.600000...`), so no extra column is required. The phrase-derived key is non-extractable and is not stored.

The circle key stored on the device is extractable. Helper links have to carry it. Where a key does not need to be copied out, it is non-extractable: the phrase wrapping key, and a file key after it is unwrapped for decrypt.

Saved visit summaries are the files. Each summary gets its own file key (AES-GCM, 256 bits), made in the browser and wrapped by the circle key. Its row in `visit_documents` stores the wrap, the wrap's IV and `key_version` (migration `0015`). Each page, or the PDF, is encrypted in the browser with the file key and uploaded as a fresh 12-byte IV followed by the ciphertext, to `{circle}/{document}/{n}.enc`. The summary's id and the page number are bound in as additional data, so a page moved to another place does not open. The server refuses a page whose first bytes are a plain JPEG or PDF, and it returns pages still encrypted; the browser unwraps the file key and opens them. On a device without the circle key, the page asks for the recovery words.

When the circle key is changed, the browser opens every file key with the previous circle key, wraps it with the new one (`rewrapFileKeys`), and `rotate_own_circle_key` stores them in the same transaction as the new key version. If any encrypted summary is not covered, the whole change is refused, so no file is left under a key that is gone.

A summary saved before `0015` has no key columns. Its files are plain and are served as before.

What this does not cover: the text read from a summary still passes through the server to build the draft (it is not saved), and the confirmed medications, reminders and events are stored unencrypted (decision 0007).

The browser keeps the circle key in IndexedDB. On a new device, after Google sign-in, the person enters the phrase and the browser unwraps the stored copy.

Helper links are `/i/{token}#k=...`. The server only creates and stores the token hash. The fragment is not sent to the server. The link page reads `#k=` in the browser, keeps it in the tab, and removes it from the address bar. The existing PIN and cookie flow is unchanged. A link without `#k=` still opens the circle. Saved visit summaries are for the caregiver only, so a helper link has no file to open with the key today.

The PIN protects server access. It does not wrap or hide the key. A forwarded link carries the key in the fragment, which is why the link has a PIN and why the caregiver can revoke it. Revoking the token stops server access. Anyone who already copied the fragment still has the key material, so revocation is not a substitute for the phrase.

Only the owner rotates the key. The database rejects a direct change to `circles.key_version` and a call to `rotate_own_circle_key` from anyone else. Rotation creates a new circle key, moves `key_version` forward by one, rewraps it for the owner, and replaces every active helper token in that same transaction. The screen says every helper needs a new link and shows those links. A helper link carries the key only when the key stored on this device is the circle's current version; otherwise the link is `/i/{token}` alone and opens everything except files.

## Not decided

Per-caregiver key pairs. Only the owner holds and changes the circle key today. This change does not build a key pair for each caregiver.

## Why

Files are the sensitive part of the circle. If the server can read the key, a database copy can read the files. Keeping the key in the browser means a lost phrase is unrecoverable on purpose: All Hands Care has nothing to reset.
