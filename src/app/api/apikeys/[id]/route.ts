import { prisma } from "@/lib/prisma";
import { handle, ok, requireAdmin } from "@/lib/api";

/** Revoke (soft-delete) an API key. */
export const DELETE = handle(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await prisma.apiKey.update({ where: { id }, data: { revoked: true } });
  return ok({ revoked: true });
});
