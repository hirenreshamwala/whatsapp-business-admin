import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok, requireAdmin, HttpError } from "@/lib/api";
import { runBroadcast } from "@/lib/whatsapp/broadcast";

export const GET = handle(async () => {
  await requireAdmin();
  const broadcasts = await prisma.broadcast.findMany({
    orderBy: { createdAt: "desc" },
    include: { template: { select: { name: true } }, _count: { select: { recipients: true } } },
  });
  return ok(
    broadcasts.map((b) => ({
      id: b.id,
      name: b.name,
      templateName: b.template.name,
      status: b.status,
      total: b.total,
      sentCount: b.sentCount,
      failedCount: b.failedCount,
      createdAt: b.createdAt,
    })),
  );
});

const createSchema = z.object({
  name: z.string().trim().min(1),
  templateId: z.string(),
  audience: z.discriminatedUnion("type", [
    z.object({ type: z.literal("all") }),
    z.object({ type: z.literal("tag"), tag: z.string().min(1) }),
    z.object({ type: z.literal("contacts"), contactIds: z.array(z.string()).min(1) }),
  ]),
});

export const POST = handle(async (req) => {
  const session = await requireAdmin();
  const body = createSchema.parse(await req.json());

  const template = await prisma.template.findUnique({ where: { id: body.templateId } });
  if (!template) throw new HttpError(404, "Template not found");
  if (template.status !== "APPROVED") throw new HttpError(400, "Only approved templates can be broadcast.");

  // Resolve audience → contacts.
  const contacts = await prisma.contact.findMany({
    where:
      body.audience.type === "all"
        ? undefined
        : body.audience.type === "tag"
          ? { tags: { has: body.audience.tag } }
          : { id: { in: body.audience.contactIds } },
    select: { id: true },
  });
  if (contacts.length === 0) throw new HttpError(400, "No contacts match this audience.");

  const broadcast = await prisma.broadcast.create({
    data: {
      name: body.name,
      templateId: body.templateId,
      status: "QUEUED",
      total: contacts.length,
      createdById: session.user.id,
      recipients: { create: contacts.map((c) => ({ contactId: c.id })) },
    },
  });

  // Fire-and-forget; the in-process queue handles pacing.
  runBroadcast(broadcast.id).catch((e) => console.error("Broadcast start failed:", e));

  return ok({ id: broadcast.id, total: contacts.length }, 201);
});
