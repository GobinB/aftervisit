# Accuracy set

How well All Hands Care reads an after-visit summary, measured on fictional summaries with known right answers. Every name, clinic, date and phone number here is made up. Never add real patient documents.

## What is in it

`cases/` holds one folder per summary:

| Case | Format |
|---|---|
| `clinic-visit` | Clinic visit, printed after-visit summary |
| `clinic-visit-portal` | Clinic visit, as pasted from a patient portal |
| `hospital-discharge` | Hospital discharge instructions, 2 pages |
| `urgent-care` | Urgent care discharge sheet |
| `prescription-label` | Pharmacy label |
| `lab-report` | Lab results with the doctor's message |
| `appointment-instructions` | Instructions before a procedure |
| `smudged-dose` | Clinic visit where one dose is covered by an ink smear |

Each folder has:

- `page-1.txt`, `page-2.txt`: the text of each page.
- `page-1.jpg`, `page-2.jpg`: the same pages as phone-style photos. They are made by `node eval/make-photos.mjs`, which prints each page in a browser and then tilts it, lights it unevenly and blurs it a little. They stand in for photos of paper; they are not photos of real documents.
- `answers.json`: the right answers. The medicines (name, what changed, dose), the visit date, and the next steps with any stated date.

## What is scored

| Column | A right answer is |
|---|---|
| Medicines | the medicine is in the draft with the right change (new, stopped, changed or continued) |
| Doses | the medicine's dose in the draft matches the page |
| Dates | the visit date and each appointment or due date are in the draft |
| Next steps | each thing to do is in the draft as a to-do |
| Unreadable dose left blank | where the dose cannot be read, the draft leaves it blank and marks the medicine *Please check this* instead of guessing |
| Flagged | how many medicines the draft marked *Please check this* |

"Extra" counts what the draft got wrong or added that is not on the page (a wrong change, a wrong dose, a heading read as a medicine).

## Running it

```bash
npm run eval
```

This runs:

1. The built-in parser on the text of each case.
2. The built-in parser on the photos, read by Tesseract the way the phone reads them. The first run downloads Tesseract's English data.
3. OpenAI on the text and on the photos, only when `OPENAI_API_KEY` is set. `EXTRACTION_MODEL` picks the model (`gpt-6.1-terra` by default). Each run sends the fictional pages to OpenAI, which is billed to that key.

The tables are printed and saved to `eval/results.md` (not committed). CI runs the built-in parser on the text only, in `tests/unit/eval-score.test.ts`, and fails if its scores drop.

## Adding a case

Make a folder under `cases/` with `page-1.txt` (and more pages if needed) and `answers.json`, then run `node eval/make-photos.mjs` to make the photos. Write `[[blot:text]]` in a page to cover that text with a smear in the photo. In `answers.json`, mark anything a reader may reasonably leave out with `"optional": true`, list dates printed on the page that are fine to report under `alsoAcceptDates`, and give `"kind"` as a list when the page does not say what changed (a label: `["new", "continue"]`).
