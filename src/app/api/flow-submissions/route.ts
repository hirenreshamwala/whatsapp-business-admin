import { prisma } from "@/lib/prisma";
import { handle, ok, requireUser } from "@/lib/api";
import { presentFlowSubmission } from "@/lib/whatsapp/flow-present";

export const GET = handle(async (req) => {
  const session = await requireUser();
  const url = new URL(req.url);
  const search = url.searchParams.get("search")?.trim();
  const flowId = url.searchParams.get("flowId") || undefined;
  const cursor = url.searchParams.get("cursor") || undefined;
  const rows = await prisma.flowSubmission.findMany({
    where: {
      ...(flowId || search ? { launch: {
        ...(flowId ? { flowId } : {}),
        ...(search ? { contact: { OR: [{ waId: { contains: search } }, { name: { contains: search, mode: "insensitive" as const } }, { profileName: { contains: search, mode: "insensitive" as const } }] } } : {}),
      } } : {}),
    },
    include: { launch: { include: { flow: true, contact: true } }, deliveries: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { completedAt: "desc" },
    take: 51,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > 50;
  const items = rows.slice(0, 50).map((row) => ({
    ...presentFlowSubmission(row, session.user.role === "ADMIN"),
    contact: row.launch.contact,
    delivery: row.deliveries[0] || null,
  }));
  return ok({ items, nextCursor: hasMore ? items[items.length - 1]?.id : null });
});
