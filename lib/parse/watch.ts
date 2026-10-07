/**
 * Step 6: watch-for. Lines inside a Watch section, plus any line that says to call
 * (the clinic / us / 911) if, seek care, or mentions worsening. List-like sentences
 * are split on top-level commas.
 * Step 7: questions. Lines inside a Questions section or containing "discuss at next
 * visit", "ask about", "consider", or ending with a question mark.
 */
import { cleanItem, splitTopLevel, wordCount } from "./util";

/** A list is worth splitting only when every part reads on its own ("any fall", not "cold"). */
function listParts(s: string): string[] | null {
  const parts = splitTopLevel(s, /^\s*[,;]\s*/).map(cleanItem).filter(Boolean);
  return parts.length > 1 && parts.every((p) => wordCount(p) >= 2) ? parts : null;
}

export const WATCH_TRIGGER_RE =
  /\b(call (?:the (?:clinic|office)|us|your (?:doctor|provider|care team)|911|9-1-1)\b.*\bif\b|seek (?:medical )?(?:care|attention|help)|go to (?:the )?(?:er|emergency)|get (?:medical )?help right away|worsen(?:s|ing)?|gets? worse|warning signs?|if you (?:notice|have|develop|experience)\b.*\b(?:call|seek|go)\b)/i;

export const QUESTION_TRIGGER_RE =
  /(\bdiscuss(?:ed)? (?:at|during) (?:the |your )?next (?:visit|appointment)|\bask (?:about|your|the)\b|\bconsider(?:ing)?\b|\bto (?:be )?discuss(?:ed)?\b|\?\s*$)/i;

/** Split "fever, chills, or redness" into separate items; keep short sentences whole. */
export function splitWatch(content: string): string[] {
  return listParts(content) ?? [cleanItem(content)].filter(Boolean);
}

/** For a free-standing watch sentence like "Call us if you have fever, chills, or redness". */
export function watchItemsFromSentence(line: string): string[] {
  const m = /^(.*?\b(?:if|for)\b(?:\s+you\s+(?:have|notice|develop|experience|see|feel))?(?:\s+any(?:\s+of\s+the\s+following)?)?)\s*:?\s+(.+)$/i.exec(line);
  if (m) {
    // "..., or swelling behind the ear, call us right away" -> drop the trailing instruction.
    const parts = listParts(m[2].replace(/,?\s*(?:then\s+|please\s+)?(?:call|seek|go to|get)\b[^,]*$/i, ""));
    if (parts && parts.length >= 3) return parts;
  }
  return [cleanItem(line)];
}

export function questionItems(content: string): string[] {
  return splitTopLevel(content, /^\s*;\s*/).map((q) => {
    const c = cleanItem(q.replace(/^(?:discuss(?:ed)? (?:at|during) (?:the |your )?next (?:visit|appointment)\s*:?\s*)/i, ""));
    return /\?$/.test(q.trim()) && !/\?$/.test(c) ? `${c}?` : c;
  }).filter(Boolean);
}
