import { v1Handle, apiOk, requireApiKey } from "@/lib/v1";
import { prisma } from "@/lib/prisma";

/** GET /api/v1/templates — list templates (optionally ?status=APPROVED). */
export const GET = v1Handle(async (req) => {
  await requireApiKey(req);
  const url = new URL(req.url);
  const status = url.searchParams.get("status")?.toUpperCase();

  const templates = await prisma.template.findMany({
    where: status ? { status: status as never } : undefined,
    orderBy: { updatedAt: "desc" },
    select: { name: true, language: true, category: true, status: true },
  });

  return apiOk({ data: templates });
});
