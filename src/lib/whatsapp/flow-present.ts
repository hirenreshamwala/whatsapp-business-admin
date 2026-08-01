import { decrypt } from "@/lib/crypto";

export function presentFlowSubmission(submission: {
  id: string;
  responseEnc: string | null;
  responseKeys: string[];
  purgedAt: Date | null;
  completedAt: Date;
  waMessageId: string | null;
  launch: { id: string; status: string; conversationId: string; flow: { id: string; name: string; sensitiveFields: string[] } };
}, revealSensitive: boolean) {
  const response = submission.responseEnc ? JSON.parse(decrypt(submission.responseEnc)) as Record<string, unknown> : null;
  const masked = response && !revealSensitive
    ? Object.fromEntries(Object.entries(response).map(([key, value]) => [key, submission.launch.flow.sensitiveFields.includes(key) ? "••••••" : value]))
    : response;
  return {
    id: submission.id,
    launchId: submission.launch.id,
    flow: { id: submission.launch.flow.id, name: submission.launch.flow.name },
    conversationId: submission.launch.conversationId,
    waMessageId: submission.waMessageId,
    response: masked,
    responseKeys: submission.responseKeys,
    purgedAt: submission.purgedAt,
    completedAt: submission.completedAt,
  };
}
