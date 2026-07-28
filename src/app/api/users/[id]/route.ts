import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handle, ok, requireAdmin, HttpError } from "@/lib/api";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "AGENT"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const PATCH = handle(async (req, { params }) => {
  const session = await requireAdmin();
  const { id } = await params;
  const body = updateSchema.parse(await req.json());

  // Guard: don't let an admin lock themselves out (demote/deactivate self).
  if (id === session.user.id && (body.role === "AGENT" || body.active === false)) {
    throw new HttpError(400, "You cannot demote or deactivate your own account");
  }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.role !== undefined) data.role = body.role;
  if (body.active !== undefined) data.active = body.active;
  if (body.password !== undefined) data.passwordHash = await bcrypt.hash(body.password, 10);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return ok(user);
});

export const DELETE = handle(async (_req, { params }) => {
  const session = await requireAdmin();
  const { id } = await params;
  if (id === session.user.id) throw new HttpError(400, "You cannot delete your own account");
  await prisma.user.delete({ where: { id } });
  return ok({ deleted: true });
});
