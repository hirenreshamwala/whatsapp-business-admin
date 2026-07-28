import { prisma } from "@/lib/prisma";
import { handle, ok, requireAdmin, HttpError } from "@/lib/api";

export const GET = handle(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  const broadcast = await prisma.broadcast.findUnique({
    where: { id },
    include: {
      template: { select: { name: true, language: true } },
      recipients: { include: { contact: { select: { waId: true, name: true, profileName: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!broadcast) throw new HttpError(404, "Broadcast not found");
  return ok(broadcast);
});
