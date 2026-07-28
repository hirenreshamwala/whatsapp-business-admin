import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok, requireAdmin } from "@/lib/api";
import { generateKey } from "@/lib/api-keys";

export const GET = handle(async () => {
  await requireAdmin();
  const keys = await prisma.apiKey.findMany({
    where: { revoked: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
  });
  return ok(keys);
});

const createSchema = z.object({ name: z.string().trim().min(1, "Name is required") });

export const POST = handle(async (req) => {
  const session = await requireAdmin();
  const { name } = createSchema.parse(await req.json());
  const gen = generateKey();

  const key = await prisma.apiKey.create({
    data: { name, keyHash: gen.keyHash, keyPrefix: gen.keyPrefix, createdById: session.user.id },
    select: { id: true, name: true, keyPrefix: true, createdAt: true },
  });

  // The plaintext is returned exactly once and never stored.
  return ok({ ...key, key: gen.plaintext }, 201);
});
