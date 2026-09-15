import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@cinecuts/db";
import { clipGenerationQueue } from "@/lib/queue";

const createSchema = z.object({
  movieId: z.string().min(1),
  title: z.string().min(1),
  caption: z.string().min(1),
  startSeconds: z.number().int().nonnegative(),
  endSeconds: z.number().int().positive(),
});

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  if (parsed.data.endSeconds - parsed.data.startSeconds > 90) {
    return NextResponse.json({ error: "Clipes devem ter no máximo 90s (formato Reels)" }, { status: 400 });
  }

  const clip = await prisma.clip.create({ data: { ...parsed.data, status: "PENDING" } });
  await clipGenerationQueue.add("generate", { clipId: clip.id }, { jobId: clip.id, attempts: 2 });

  return NextResponse.json({ clip });
}
