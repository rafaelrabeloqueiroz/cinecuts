import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@cinecuts/db";
import { socialPostingQueue } from "@/lib/queue";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const post = await prisma.socialPost.findUnique({ where: { id: params.id } });
  if (!post) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await prisma.socialPost.update({ where: { id: post.id }, data: { scheduledFor: new Date(), status: "SCHEDULED" } });
  await socialPostingQueue.add("post", { socialPostId: post.id }, { jobId: `${post.id}-${Date.now()}`, attempts: 3 });

  return NextResponse.json({ ok: true });
}
