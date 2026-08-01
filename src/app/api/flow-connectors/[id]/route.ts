import { prisma } from "@/lib/prisma";
import { handle, ok, requireAdmin } from "@/lib/api";

export const DELETE = handle(async (_req, { params }) => {
  await requireAdmin();
  await prisma.flowConnector.delete({ where: { id: (await params).id } });
  return ok({ deleted: true });
});
