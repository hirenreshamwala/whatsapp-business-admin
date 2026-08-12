import { z } from "zod";
import { v1Handle, apiOk, requireApiKey, ApiError, parseJsonBody } from "@/lib/v1";
import { prisma } from "@/lib/prisma";
import { runBroadcast } from "@/lib/whatsapp/broadcast";

const schema = z.object({
  apikey: z.string().optional(),
  name: z.string().min(1),
  template: z.string().min(1),
  language: z.string().optional(),
  audience: z
    .discriminatedUnion("type", [
      z.object({ type: z.literal("all") }),
      z.object({ type: z.literal("tag"), tag: z.string().min(1) }),
    ])
    .optional(),
});

/**
 * POST /api/v1/broadcasts — send an approved template to all contacts or a tag.
 * { "name":"Diwali", "template":"promo_oct", "audience":{"type":"tag","tag":"vip"} }
 */
export const POST = v1Handle(async (req) => {
  const raw = await parseJsonBody(req);
  const body = schema.parse(raw);
  const principal = await requireApiKey(req, body);

  const template = await prisma.template.findFirst({
    where: { name: body.template, status: "APPROVED", ...(body.language ? { language: body.language } : {}) },
  });
  if (!template) throw new ApiError(404, `No approved template named "${body.template}"`);

  const audience = body.audience ?? { type: "all" as const };
  const contacts = await prisma.contact.findMany({
    where: audience.type === "tag" ? { tags: { has: audience.tag } } : undefined,
    select: { id: true },
  });
  if (contacts.length === 0) throw new ApiError(400, "No contacts match this audience");

  const broadcast = await prisma.broadcast.create({
    data: {
      name: body.name,
      templateId: template.id,
      status: "QUEUED",
      total: contacts.length,
      createdById: principal.userId,
      recipients: { create: contacts.map((c) => ({ contactId: c.id })) },
    },
  });

  runBroadcast(broadcast.id).catch((e) => console.error("Broadcast start failed:", e));
  return apiOk({ broadcast_id: broadcast.id, total: contacts.length }, 201);
});
