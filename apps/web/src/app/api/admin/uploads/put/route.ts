import { NextResponse } from "next/server";
import { storage, storageDriverName } from "@cinecuts/storage";
import { requireAdminSession } from "@/lib/admin";

export const runtime = "nodejs";

/** Recebe o PUT do navegador quando o storage local está ativo (sem S3/URL pré-assinada). */
export async function PUT(req: Request) {
  const session = await requireAdminSession();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  if (storageDriverName !== "local") {
    return NextResponse.json({ error: "Upload direto só existe no storage local" }, { status: 400 });
  }

  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "Chave ausente" }, { status: 400 });

  const contentType = req.headers.get("content-type") ?? "application/octet-stream";
  const body = Buffer.from(await req.arrayBuffer());

  try {
    await storage.uploadFromBuffer(key, body, contentType);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, storageKey: key });
}
