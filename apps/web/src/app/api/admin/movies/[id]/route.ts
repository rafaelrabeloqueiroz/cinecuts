import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@cinecuts/db";

const patchSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
});

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const movie = await prisma.movie.findUnique({
    where: { id: params.id },
    include: { clips: { include: { socialPosts: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!movie) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ movie });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const movie = await prisma.movie.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json({ movie });
}
