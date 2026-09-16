import { NextResponse } from "next/server";
import { z } from "zod";
import { storage } from "@cinecuts/storage";
import { requireAdminSession } from "@/lib/admin";

const schema = z.object({
  kind: z.enum(["movie", "poster"]),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  contentType: z.string().min(1),
  extension: z.string().min(1).max(10).regex(/^[A-Za-z0-9]+$/),
});

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { kind, slug, contentType, extension } = parsed.data;
  const storageKey = kind === "movie" ? `movies/${slug}/source.${extension}` : `movies/${slug}/poster.${extension}`;

  const uploadUrl = await storage.createUploadUrl(storageKey, contentType);
  return NextResponse.json({ uploadUrl, storageKey });
}
