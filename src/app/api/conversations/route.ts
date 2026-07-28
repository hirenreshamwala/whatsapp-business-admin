import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok, requireUser } from "@/lib/api";
import { ensureConversation, isWithinSessionWindow } from "@/lib/whatsapp/send";

export const GET = handle(async (req) => {
  await requireUser();
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();

  const conversations = await prisma.conversation.findMany({
    where: search
      ? {
          contact: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { profileName: { contains: search, mode: "insensitive" } },
              { waId: { contains: search } },
            ],
          },
        }
      : undefined,
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    take: 200,
    include: { contact: true },
  });

  return ok(
    conversations.map((c) => ({
      id: c.id,
      contact: { id: c.contact.id, waId: c.contact.waId, name: c.contact.name, profileName: c.contact.profileName },
      lastPreview: c.lastPreview,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
      status: c.status,
      windowOpen: isWithinSessionWindow(c.lastInboundAt),
    })),
  );
});

const startSchema = z.object({
  waId: z.string().trim().regex(/^\d{7,15}$/),
  name: z.string().trim().optional(),
});

/** Start (or resume) a conversation for a phone number. */
export const POST = handle(async (req) => {
  await requireUser();
  const body = startSchema.parse(await req.json());
  const { conversation, contact } = await ensureConversation(body.waId, body.name);
  return ok({ id: conversation.id, contactId: contact.id }, 201);
});
