import { getRailwayCatalogLine } from "../data/railwayCatalog.ts";
import { validateCommunityReportVote } from "./communityReports.ts";
import type { RailwayCatalogLine } from "../types/railway.ts";
import type { CommunityReportVote } from "../types/community.ts";

export interface ValidCommunityReportSubmission {
  vote: CommunityReportVote;
  catalogLine: RailwayCatalogLine;
}

/** 本文の形式と、投稿対象として利用可能な路線かをまとめて検証する。 */
export function validateCommunityReportSubmission(
  input: unknown,
): ValidCommunityReportSubmission | null {
  const vote = validateCommunityReportVote(input);
  if (!vote) return null;
  const catalogLine = getRailwayCatalogLine(vote.lineId);
  if (!catalogLine || catalogLine.coverage === "unavailable") return null;
  return { vote, catalogLine };
}
