import "server-only";

/** Handoff data access now lives in store/. App routes keep importing this file so they never import store/. */
export {
  addTombstone,
  clientFor,
  db,
  getHandoff,
  getTombstone,
  hardDeleteHandoff,
  isExpired,
  serviceClient,
  toView,
  userClient,
  type GoneReason,
  type HandoffRow,
} from "@/store/db";
