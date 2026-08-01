import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { handle, HttpError, ok, requireAdmin, requireUser } from "@/lib/api";
import { deleteFlow, updateLocalFlowVersion } from "@/lib/whatsapp/flow-service";
import { FLOW_CATEGORIES } from "@/lib/whatsapp/flow-types";
import { assertSafeConnectorUrl } from "@/lib/whatsapp/flow-connector";

export const GET = handle(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const flow = await prisma.flow.findUnique({
    where: { id },
    include: { activeVersion: { include: { bindings: true } }, versions: { orderBy: { revision: "desc" } } },
  });
  if (!flow) throw new HttpError(404, "Flow not found");
  return ok({ ...flow, completionSecretSet: Boolean(flow.completionSecretEnc), completionSecretEnc: undefined });
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  categories: z.array(z.enum(FLOW_CATEGORIES)).min(1).optional(),
  retentionDays: z.number().int().min(1).max(3650).optional(),
  sensitiveFields: z.array(z.string()).optional(),
  completionWebhookUrl: z.string().url().nullable().optional(),
  completionSecret: z.string().min(16).optional(),
  flowJson: z.unknown(),
});

export const PATCH = handle(async (req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const body = updateSchema.parse(await req.json());
  if (body.completionWebhookUrl) {
    const host = new URL(body.completionWebhookUrl).hostname;
    await assertSafeConnectorUrl(body.completionWebhookUrl, [host]);
  }
  const result = await updateLocalFlowVersion(id, { ...body, flowJson: body.flowJson as never });
  if (body.completionSecret) {
    await prisma.flow.update({ where: { id }, data: { completionSecretEnc: encrypt(body.completionSecret) } });
  }
  return ok(result);
});

export const DELETE = handle(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await deleteFlow(id);
  return ok({ deleted: true });
});
