import { parse } from "../parse";
import { HandoffDraftSchema } from "../schema";
import { goodToKnowLines } from "./good-to-know";
import type { ExtractionProvider } from "./provider";

/**
 * Default provider: the deterministic parser in lib/parse. No network, no key.
 * The parser keeps every line it could not place; the draft lists only those that read like an
 * instruction, as "Good to know". The rest stay in the original, shown beside the draft.
 */
export const heuristicProvider: ExtractionProvider = {
  name: "heuristic",
  async extract({ text, patientFirstName }) {
    const draft = parse({ text, patientFirstName });
    return HandoffDraftSchema.parse({ ...draft, otherNotes: goodToKnowLines(draft.otherNotes) });
  },
};
