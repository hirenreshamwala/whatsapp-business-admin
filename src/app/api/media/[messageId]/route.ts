import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, HttpError, handle } from "@/lib/api";
import { mediaStore } from "@/lib/media";

/** Stream stored media for a message. Requires an authenticated session. */
export const GET = handle(async (_req, { params }) => {
  await requireUser();
  const { messageId } = await params;

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message || !message.mediaPath) throw new HttpError(404, "Media not found");

  const data = await mediaStore.read(message.mediaPath);
  const body = new Uint8Array(data);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": message.mediaMime || "application/octet-stream",
      "Content-Length": String(body.byteLength),
      "Cache-Control": "private, max-age=86400",
      ...(message.mediaFilename ? { "Content-Disposition": `inline; filename="${message.mediaFilename}"` } : {}),
    },
  });
});
