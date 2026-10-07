import { parse } from "../parse";
import { HandoffDraftSchema } from "../schema";
import type { ExtractionProvider } from "./provider";

/** Default provider: the deterministic parser in lib/parse. No network, no key. */
export const heuristicProvider: ExtractionProvider = {
  name: "heuristic",
  async extract({ text, patientFirstName }) {
    return HandoffDraftSchema.parse(parse({ text, patientFirstName }));
  },
};
