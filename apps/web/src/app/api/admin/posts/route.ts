import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@cinecuts/db";

const createSchema = z.object({
  clipId: z.string().min(1),
  caption: z.string().min(1),
  scheduledFor: z.string().datetime(),
});

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const clip = await prisma.clip.findUnique({ where: { id: parsed.data.clipId } });
  if (!clip) return NextResponse.json({ error: "Clipe não encontrado" }, { status: 404 });
  if (clip.status !== "READY") {
    return NextResponse.json({ error: "Clipe ainda não está pronto (status != READY)" }, { status: 400 });
  }

  const post = await prisma.socialPost.create({
    data: {
      clipId: clip.id,
      caption: parsed.data.caption,
      scheduledFor: new Date(parsed.data.scheduledFor),
      status: "SCHEDULED",
    },
  });

  return NextResponse.json({ post });
}
