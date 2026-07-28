import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok, requireUser, HttpError } from "@/lib/api";
import { serializeMessage } from "@/lib/whatsapp/webhook";
import { sendMessage, isWithinSessionWindow, type OutboundContent } from "@/lib/whatsapp/send";
import { uploadOutboundMedia } from "@/lib/whatsapp/media";
import { mediaStore, extFromMime } from "@/lib/media";
import { templateExampleComponents } from "@/lib/whatsapp/template-service";
import type { ApiComponent } from "@/lib/whatsapp/template-types";

/** Fetch the thread (oldest → newest) and mark it read. */
export const GET = handle(async (_req, { params }) => {
  await requireUser();
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({ where: { id }, include: { contact: true } });
  if (!conversation) throw new HttpError(404, "Conversation not found");

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { timestamp: "asc" },
    take: 200,
  });

  // Mark read.
  if (conversation.unreadCount > 0) {
    await prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } });
  }

  return ok({
    conversation: {
      id: conversation.id,
      contact: conversation.contact,
      windowOpen: isWithinSessionWindow(conversation.lastInboundAt),
      lastInboundAt: conversation.lastInboundAt,
    },
    messages: messages.map(serializeMessage),
  });
});

const textSchema = z.object({ kind: z.literal("text"), text: z.string().min(1) });
const templateSchema = z.object({
  kind: z.literal("template"),
  templateId: z.string(),
});

/**
 * Send a message. JSON body for text/template; multipart/form-data for media.
 * Enforces the 24h session window for free-form (text/media) messages.
 */
export const POST = handle(async (req, { params }) => {
  const session = await requireUser();
  const { id } = await params;

  const conversation = await prisma.conversation.findUnique({ where: { id }, include: { contact: true } });
  if (!conversation) throw new HttpError(404, "Conversation not found");
  const to = conversation.contact.waId;
  const windowOpen = isWithinSessionWindow(conversation.lastInboundAt);

  const contentType = req.headers.get("content-type") || "";

  // ---- Media (multipart) ----
  if (contentType.includes("multipart/form-data")) {
    if (!windowOpen) throw new HttpError(403, "This chat is outside the 24-hour window. Send an approved template instead.");
    const form = await req.formData();
    const file = form.get("file");
    const caption = (form.get("caption") as string) || undefined;
    if (!(file instanceof File)) throw new HttpError(400, "No file provided");

    const buffer = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    const mediaType = mime.startsWith("image/")
      ? "image"
      : mime.startsWith("video/")
        ? "video"
        : mime.startsWith("audio/")
          ? "audio"
          : "document";

    // Upload to Meta, and keep a local copy so the thread can render it.
    const mediaId = await uploadOutboundMedia({ data: buffer, mimeType: mime, fileName: file.name });
    const localPath = await mediaStore.save(buffer, extFromMime(mime));

    const message = await sendMessage({
      conversationId: id,
      to,
      sentById: session.user.id,
      content: {
        kind: "media",
        mediaType: mediaType as "image" | "video" | "audio" | "document",
        mediaId,
        caption,
        mediaPath: localPath,
        mediaMime: mime,
        filename: file.name,
      },
    });
    return ok(serializeMessage(message), 201);
  }

  // ---- Text / Template (JSON) ----
  const body = await req.json();

  if (body.kind === "template") {
    const parsed = templateSchema.parse(body);
    const template = await prisma.template.findUnique({ where: { id: parsed.templateId } });
    if (!template) throw new HttpError(404, "Template not found");
    if (template.status !== "APPROVED") throw new HttpError(400, "Only approved templates can be sent.");

    const content: OutboundContent = {
      kind: "template",
      templateId: template.id,
      templateName: template.name,
      language: template.language,
      components: templateExampleComponents(template.components as unknown as ApiComponent[]),
      preview: `Template: ${template.name}`,
    };
    const message = await sendMessage({ conversationId: id, to, sentById: session.user.id, content });
    return ok(serializeMessage(message), 201);
  }

  // text
  const parsed = textSchema.parse(body);
  if (!windowOpen) throw new HttpError(403, "This chat is outside the 24-hour window. Send an approved template instead.");
  const message = await sendMessage({
    conversationId: id,
    to,
    sentById: session.user.id,
    content: { kind: "text", text: parsed.text },
  });
  return ok(serializeMessage(message), 201);
});
