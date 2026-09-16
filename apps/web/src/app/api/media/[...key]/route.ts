import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { getServerSession } from "next-auth";
import { localPathForKey, sanitizeStorageKey } from "@cinecuts/storage";
import { authOptions } from "@/lib/auth";
import { userHasActiveSubscription } from "@/lib/subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function contentTypeFor(key: string): string {
  const extension = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[extension] ?? "application/octet-stream";
}

/**
 * Material de divulgação é público de propósito: clipes precisam ser baixáveis
 * pelo Instagram e pôsteres aparecem na landing para quem ainda não assinou.
 * O filme completo é o que exige assinatura ativa.
 */
async function authorize(key: string): Promise<{ ok: true } | { ok: false; status: number }> {
  const isPromotional = key.startsWith("clips/") || /\/poster\.[a-z0-9]+$/i.test(key);
  if (isPromotional) return { ok: true };

  const session = await getServerSession(authOptions);
  if (!session?.user) return { ok: false, status: 401 };

  const userId = (session.user as { id: string }).id;
  if (!(await userHasActiveSubscription(userId))) return { ok: false, status: 403 };

  return { ok: true };
}

export async function GET(req: Request, { params }: { params: { key: string[] } }) {
  let key: string;
  try {
    key = sanitizeStorageKey(params.key.join("/"));
  } catch {
    return NextResponse.json({ error: "Chave inválida" }, { status: 400 });
  }

  const authorization = await authorize(key);
  if (!authorization.ok) {
    return NextResponse.json({ error: "Acesso negado" }, { status: authorization.status });
  }

  let size: number;
  let path: string;
  try {
    path = localPathForKey(key);
    size = (await stat(path)).size;
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const contentType = contentTypeFor(key);
  const range = req.headers.get("range");

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        return new NextResponse(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }

      const stream = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream;
      return new NextResponse(stream, {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(end - start + 1),
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
        },
      });
    }
  }

  const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
    },
  });
}
