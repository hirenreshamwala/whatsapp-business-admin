import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok, requireAdmin, requireUser } from "@/lib/api";
import { createLocalFlow } from "@/lib/whatsapp/flow-service";
import { FLOW_CATEGORIES } from "@/lib/whatsapp/flow-types";

export const GET = handle(async (req) => {
  await requireUser();
  const published = new URL(req.url).searchParams.get("published") === "true";
  const flows = await prisma.flow.findMany({
    where: published ? { versions: { some: { status: "PUBLISHED" } } } : undefined,
    include: {
      activeVersion: true,
      versions: { where: { status: "PUBLISHED" }, orderBy: { revision: "desc" }, take: 1 },
      _count: { select: { launches: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return ok(published ? flows.map((flow) => ({ ...flow, activeVersion: flow.versions[0], versions: undefined })) : flows);
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  categories: z.array(z.enum(FLOW_CATEGORIES)).min(1).default(["OTHER"]),
  retentionDays: z.number().int().min(1).max(3650).default(90),
  flowJson: z.unknown().optional(),
});

export const POST = handle(async (req) => {
  const session = await requireAdmin();
  const body = createSchema.parse(await req.json());
  const flow = await createLocalFlow({ ...body, flowJson: body.flowJson as never, createdById: session.user.id });
  return ok({ id: flow.id }, 201);
});
