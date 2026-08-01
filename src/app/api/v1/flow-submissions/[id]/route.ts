import { prisma } from "@/lib/prisma";
import { ApiError, apiOk, requireApiKey, v1Handle } from "@/lib/v1";
import { presentFlowSubmission } from "@/lib/whatsapp/flow-present";

export const GET = v1Handle(async (req, { params }) => {
  await requireApiKey(req);
  const row = await prisma.flowSubmission.findUnique({ where: { id: (await params).id }, include: { launch: { include: { flow: true, contact: true } }, deliveries: true } });
  if (!row) throw new ApiError(404, "Flow submission not found");
  return apiOk({ submission: { ...presentFlowSubmission(row, true), contact: { id: row.launch.contact.id, wa_id: row.launch.contact.waId }, deliveries: row.deliveries } });
});
