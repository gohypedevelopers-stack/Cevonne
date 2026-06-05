export type CevonneResponseStatus = "PASS" | "BLOCK" | "MANUAL_ONLY" | "ERROR";

export type CevonneResponse = {
  status: CevonneResponseStatus;
  response_type?: string;
  fail_reason?: string | null;
  failure_reasons?: string[];
  message?: string;
  id?: string;
  recommendation_only?: boolean;
  dry_run?: boolean;
  not_executed?: boolean;
  handled_at?: string;
  [key: string]: unknown;
};

export const CEVONNE_SAFE_RESPONSE_MESSAGE =
  "We could not complete this automatically. Your request has been received for review or support.";

export const CEVONNE_MANUAL_REVIEW_MESSAGE = "This request requires manual review.";

export const CEVONNE_TEMPORARY_FAILURE_MESSAGE =
  "We could not complete this automatically right now. Please try again later.";

const pickSafeMetadata = (response: CevonneResponse) => ({
  response_type: response.response_type,
  id:
    (typeof response.id === "string" && response.id.trim()) ||
    (typeof response.event_id === "string" && response.event_id.trim()) ||
    undefined,
  recommendation_only: response.recommendation_only,
  dry_run: response.dry_run,
  not_executed: response.status === "PASS" ? response.not_executed ?? false : true,
  handled_at: response.handled_at,
});

export const handleCevonneN8nResponse = (response: CevonneResponse): CevonneResponse => {
  switch (response.status) {
    case "PASS":
      return {
        status: "PASS",
        message: "Recorded.",
        ...pickSafeMetadata(response),
      };
    case "BLOCK":
      return {
        status: "BLOCK",
        message: CEVONNE_SAFE_RESPONSE_MESSAGE,
        ...pickSafeMetadata(response),
      };
    case "MANUAL_ONLY":
      return {
        status: "MANUAL_ONLY",
        message: CEVONNE_MANUAL_REVIEW_MESSAGE,
        ...pickSafeMetadata(response),
      };
    case "ERROR":
    default:
      return {
        status: "ERROR",
        message: CEVONNE_TEMPORARY_FAILURE_MESSAGE,
        ...pickSafeMetadata(response),
      };
  }
};

export const getCevonneResponseMessage = (
  response: Pick<CevonneResponse, "status" | "message"> | null | undefined,
) => {
  if (!response) {
    return CEVONNE_TEMPORARY_FAILURE_MESSAGE;
  }

  switch (response.status) {
    case "PASS":
      return response.message?.trim() || "Recorded.";
    case "BLOCK":
      return CEVONNE_SAFE_RESPONSE_MESSAGE;
    case "MANUAL_ONLY":
      return CEVONNE_MANUAL_REVIEW_MESSAGE;
    case "ERROR":
    default:
      return CEVONNE_TEMPORARY_FAILURE_MESSAGE;
  }
};
