import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok, requireUser, requireAdmin } from "@/lib/api";

const updateSchema = z.object({
  name: z.string().trim().nullable().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export const PATCH = handle(async (req, { params }) => {
  await requireUser();
  const { id } = await params;
  const body = updateSchema.parse(await req.json());
  const contact = await prisma.contact.update({
    where: { id },
    data: {
      name: body.name ?? undefined,
      tags: body.tags ?? undefined,
      notes: body.notes ?? undefined,
    },
  });
  return ok(contact);
});

export const DELETE = handle(async (_req, { params }) => {
  await requireAdmin();
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return ok({ deleted: true });
});
