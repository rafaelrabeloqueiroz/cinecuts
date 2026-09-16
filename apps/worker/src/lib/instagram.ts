const GRAPH_API_VERSION = "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}`);
  return value;
}

export function isInstagramConfigured(): boolean {
  return Boolean(process.env.IG_BUSINESS_ACCOUNT_ID && process.env.IG_LONG_LIVED_ACCESS_TOKEN);
}

type GraphError = { error?: { message?: string } };

async function graphFetch<T>(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET"): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const accessToken = requireEnv("IG_LONG_LIVED_ACCESS_TOKEN");

  if (method === "GET") {
    for (const [key, value] of Object.entries({ ...params, access_token: accessToken })) {
      url.searchParams.set(key, value);
    }
    const res = await fetch(url.toString());
    const body = (await res.json()) as T & GraphError;
    if (!res.ok) throw new Error(body.error?.message ?? `Erro na Graph API (${res.status})`);
    return body;
  }

  const body = new URLSearchParams({ ...params, access_token: accessToken });
  const res = await fetch(url.toString(), { method: "POST", body });
  const json = (await res.json()) as T & GraphError;
  if (!res.ok) throw new Error(json.error?.message ?? `Erro na Graph API (${res.status})`);
  return json;
}

/** Cria um container de mídia (Reels) a partir de uma URL de vídeo publicamente acessível. */
export async function createReelsContainer(videoUrl: string, caption: string): Promise<string> {
  const igUserId = requireEnv("IG_BUSINESS_ACCOUNT_ID");
  const result = await graphFetch<{ id: string }>(
    `/${igUserId}/media`,
    { media_type: "REELS", video_url: videoUrl, caption, share_to_feed: "true" },
    "POST"
  );
  return result.id;
}

/** Aguarda o processamento do vídeo pelo Instagram (assíncrono) até FINISHED ou ERROR. */
export async function waitForContainerReady(containerId: string, timeoutMs = 5 * 60 * 1000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await graphFetch<{ status_code: string }>(`/${containerId}`, { fields: "status_code" });
    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") throw new Error("Processamento do vídeo falhou no Instagram");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Tempo esgotado esperando o Instagram processar o vídeo");
}

/** Publica um container já processado, retornando o ID do post publicado. */
export async function publishContainer(containerId: string): Promise<string> {
  const igUserId = requireEnv("IG_BUSINESS_ACCOUNT_ID");
  const result = await graphFetch<{ id: string }>(
    `/${igUserId}/media_publish`,
    { creation_id: containerId },
    "POST"
  );
  return result.id;
}
