import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { handle, ok, requireAdmin, HttpError } from "@/lib/api";

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "AGENT"]),
});

export const GET = handle(async () => {
  await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return ok(users);
});

export const POST = handle(async (req) => {
  await requireAdmin();
  const body = createSchema.parse(await req.json());

  const exists = await prisma.user.findUnique({ where: { email: body.email } });
  if (exists) throw new HttpError(409, "A user with that email already exists");

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: { name: body.name, email: body.email, role: body.role, passwordHash },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true },
  });
  return ok(user, 201);
});
