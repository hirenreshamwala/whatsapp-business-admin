import { prisma } from "@/lib/prisma";
import { handle, HttpError, ok, requireUser } from "@/lib/api";
import { presentFlowSubmission } from "@/lib/whatsapp/flow-present";

export const GET = handle(async (_req, { params }) => {
  const session = await requireUser();
  const row = await prisma.flowSubmission.findUnique({ where: { id: (await params).id }, include: { launch: { include: { flow: true, contact: true } }, deliveries: { orderBy: { createdAt: "desc" } } } });
  if (!row) throw new HttpError(404, "Submission not found");
  return ok({ ...presentFlowSubmission(row, session.user.role === "ADMIN"), contact: row.launch.contact, deliveries: row.deliveries });
});
