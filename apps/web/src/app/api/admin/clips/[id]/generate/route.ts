import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@cinecuts/db";
import { clipGenerationQueue } from "@/lib/queue";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const clip = await prisma.clip.findUnique({ where: { id: params.id } });
  if (!clip) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });

  await prisma.clip.update({ where: { id: clip.id }, data: { status: "PENDING", errorMessage: null } });
  await clipGenerationQueue.add("generate", { clipId: clip.id }, { jobId: `${clip.id}-${Date.now()}`, attempts: 2 });

  return NextResponse.json({ ok: true });
}
