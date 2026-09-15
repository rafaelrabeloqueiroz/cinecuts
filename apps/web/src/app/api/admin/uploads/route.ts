import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminSession } from "@/lib/admin";
import { createUploadUrl } from "@/lib/storage";

const schema = z.object({
  kind: z.enum(["movie", "poster"]),
  slug: z.string().min(1),
  contentType: z.string().min(1),
  extension: z.string().min(1).max(10),
});

export async function POST(req: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const { kind, slug, contentType, extension } = parsed.data;
  const storageKey = kind === "movie" ? `movies/${slug}/source.${extension}` : `movies/${slug}/poster.${extension}`;

  const uploadUrl = await createUploadUrl(storageKey, contentType);
  return NextResponse.json({ uploadUrl, storageKey });
}
