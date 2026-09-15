import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@cinecuts/db";

const createSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "slug deve conter apenas letras minúsculas, números e hífens"),
  description: z.string().min(1),
  releaseYear: z.number().int().optional(),
  publicDomainNotes: z.string().min(1),
  videoStorageKey: z.string().min(1),
  posterStorageKey: z.string().optional(),
  durationSeconds: z.number().int().positive(),
});

export async function GET() {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const movies = await prisma.movie.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clips: true } } },
  });
  return NextResponse.json({ movies });
}

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const movie = await prisma.movie.create({ data: { ...parsed.data, status: "DRAFT" } });
  return NextResponse.json({ movie });
}
