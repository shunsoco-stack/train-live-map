export type CommunityReportStatus =
  | "on-time"
  | "delayed"
  | "suspended";

export interface CommunityReportVote {
  lineId: string;
  status: CommunityReportStatus;
  delayMinutes: number | null;
}

export interface CommunityReportRecord extends CommunityReportVote {
  reporterHash: string;
  createdAt: string;
}

export interface CommunityReportCounts {
  onTime: number;
  delayed: number;
  suspended: number;
}

export interface CommunityReportSummary {
  lineId: string;
  status: CommunityReportStatus;
  delayMinutes: number | null;
  voteCount: number;
  counts: CommunityReportCounts;
  updatedAt: string;
}

export interface CommunityReportsApiResponse {
  summaries: CommunityReportSummary[];
  windowMinutes: number;
  cooldownSeconds: number;
  persistent: boolean;
  votingEnabled: boolean;
}

export interface CommunityReportSubmitResponse
  extends CommunityReportsApiResponse {
  summary: CommunityReportSummary;
}
