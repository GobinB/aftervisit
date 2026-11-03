# 0015. File keys stay in the browser

## Decision

Each circle has one key. The caregiver's browser creates it with Web Crypto (AES-GCM, 256 bits). The server stores only a wrapped copy on that caregiver's `circle_caregivers` row, plus `key_version`. It never receives the raw key or the recovery phrase.

The recovery phrase is 12 BIP39 English words (128 bits plus a checksum). It is shown once, at circle creation, and the person types three of the words before continuing. The screen says that if every caregiver loses the phrase, files cannot be recovered. The browser derives a wrapping key with PBKDF2-SHA256, 600,000 iterations, a random 16-byte salt, and AES-GCM. Web Crypto provides PBKDF2. Argon2 and scrypt are not in the browser API, and a WASM library would be a new dependency. 600,000 iterations is the OWASP 2023 minimum for PBKDF2-SHA256, which makes guessing a 12-word phrase impractical. The salt, IV, and ciphertext travel inside `circle_key_wrapped` (`av1.600000...`), so no extra column is required. The phrase-derived key is non-extractable and is not stored.

The circle key stored on the device is extractable. Helper links have to carry it. Where a key does not need to be copied out, it is non-extractable: the phrase wrapping key, and a file key after it is unwrapped for decrypt.

Planned, not built: each file gets its own key, wrapped by the circle key. The wrap, the IV, and `key_version` are what a file row will store. There is no files table yet. `rewrapFileKeys` has the signature for a later change and is not called from the app.

The browser keeps the circle key in IndexedDB. On a new device, after Google sign-in, the person enters the phrase and the browser unwraps the stored copy.

Helper links are `/i/{token}#k=...`. The server only creates and stores the token hash. The fragment is not sent to the server. The link page reads `#k=` in the browser, keeps it in the tab, and removes it from the address bar. The existing PIN and cookie flow is unchanged. A link without `#k=` still opens the circle. There are no files to decrypt yet.

The PIN protects server access. It does not wrap or hide the key. A forwarded link carries the key in the fragment, which is why the link has a PIN and why the caregiver can revoke it. Revoking the token stops server access. Anyone who already copied the fragment still has the key material, so revocation is not a substitute for the phrase.

Only the owner rotates the key. The database rejects a direct change to `circles.key_version` and a call to `rotate_own_circle_key` from anyone else. Rotation creates a new circle key, moves `key_version` forward by one, rewraps it for the owner, and replaces every active helper token in that same transaction. The screen says every helper needs a new link and shows those links. A helper link is built only when the key stored on this device is the circle's current version.

## Not decided

Per-caregiver key pairs. Only the owner holds and changes the circle key today. This change does not build a key pair for each caregiver.

## Why

Files are the sensitive part of the circle. If the server can read the key, a database copy can read the files. Keeping the key in the browser means a lost phrase is unrecoverable on purpose: AfterVisit has nothing to reset.
