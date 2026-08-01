import { prisma } from "@/lib/prisma";
import { handle, HttpError, ok, requireAdmin } from "@/lib/api";
import { processFlowDeliveryQueue } from "@/lib/whatsapp/flow-submission";

export const POST = handle(async (_req, { params }) => {
  await requireAdmin();
  const id = (await params).id;
  const submission = await prisma.flowSubmission.findUnique({ where: { id }, include: { launch: { include: { flow: true } } } });
  if (!submission) throw new HttpError(404, "Submission not found");
  if (!submission.launch.flow.completionWebhookUrl || !submission.launch.flow.completionSecretEnc) throw new HttpError(409, "This Flow has no configured completion webhook.");
  await prisma.flowDeliveryAttempt.create({ data: { submissionId: id, nextAttemptAt: new Date() } });
  await processFlowDeliveryQueue(1);
  return ok({ queued: true });
});
