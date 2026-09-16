/**
 * Obras publicadas há mais de 95 anos são domínio público nos EUA. Serve como
 * piso conservador quando o item não declara licença; não substitui checagem
 * na jurisdição de destino.
 */
export const PUBLIC_DOMAIN_YEAR_CUTOFF = new Date().getFullYear() - 96;

const SEARCH_ENDPOINT = "https://archive.org/advancedsearch.php";
const METADATA_ENDPOINT = "https://archive.org/metadata";
const DOWNLOAD_ENDPOINT = "https://archive.org/download";
const THUMBNAIL_ENDPOINT = "https://archive.org/services/img";

export type ArchiveSearchDoc = {
  identifier: string;
  title?: string;
  year?: string | number;
  description?: string | string[];
};

type ArchiveFile = {
  name: string;
  format?: string;
  size?: string;
  length?: string;
  source?: string;
};

export type ArchiveItem = {
  identifier: string;
  title: string;
  description: string;
  releaseYear: number | null;
  videoUrl: string;
  posterUrl: string;
  durationSeconds: number;
  licenseNote: string;
  /** Licença declarada no item ou obra antiga o bastante para ser domínio público. */
  rightsVerified: boolean;
};

/** `length` vem como "5460.00" ou "1:31:00" dependendo do derivativo. */
function parseLength(raw: string | undefined): number {
  if (!raw) return 0;
  if (raw.includes(":")) {
    const parts = raw.split(":").map(Number);
    if (parts.some(Number.isNaN)) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
  }
  const seconds = Number(raw);
  return Number.isNaN(seconds) ? 0 : Math.round(seconds);
}

function firstString(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Escolhe o melhor derivativo mp4: h.264 quando existir, senão o maior arquivo. */
function pickVideoFile(files: ArchiveFile[]): ArchiveFile | null {
  const candidates = files.filter((file) => /\.(mp4|m4v)$/i.test(file.name));
  if (candidates.length === 0) return null;

  const h264 = candidates.filter((file) => /h\.?264/i.test(file.format ?? ""));
  const pool = h264.length > 0 ? h264 : candidates;

  return pool.reduce((best, file) => (Number(file.size ?? 0) > Number(best.size ?? 0) ? file : best));
}

export async function searchCollection(
  collection: string,
  page: number,
  rows: number
): Promise<{ docs: ArchiveSearchDoc[]; numFound: number }> {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("q", `collection:(${collection}) AND mediatype:(movies)`);
  url.searchParams.set("rows", String(rows));
  url.searchParams.set("page", String(page));
  url.searchParams.set("output", "json");
  // Mais baixados primeiro: traz os títulos conhecidos antes dos uploads obscuros.
  url.searchParams.append("sort[]", "downloads desc");
  for (const field of ["identifier", "title", "year", "description"]) {
    url.searchParams.append("fl[]", field);
  }

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Busca no Internet Archive falhou (${res.status})`);

  const body = (await res.json()) as { response?: { docs?: ArchiveSearchDoc[]; numFound?: number } };
  return { docs: body.response?.docs ?? [], numFound: body.response?.numFound ?? 0 };
}

/** Resolve um item para os dados que o catálogo precisa, ou null se não houver vídeo utilizável. */
export async function resolveItem(identifier: string): Promise<ArchiveItem | null> {
  const res = await fetch(`${METADATA_ENDPOINT}/${encodeURIComponent(identifier)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;

  const body = (await res.json()) as {
    files?: ArchiveFile[];
    metadata?: Record<string, string | string[] | undefined>;
  };

  const metadata = body.metadata;
  if (!metadata) return null;

  const videoFile = pickVideoFile(body.files ?? []);
  if (!videoFile) return null;

  const yearRaw = firstString(metadata.year) || firstString(metadata.date).slice(0, 4);
  const year = Number(yearRaw);

  const licenseUrl = firstString(metadata.licenseurl);
  const collections = Array.isArray(metadata.collection)
    ? metadata.collection.join(", ")
    : firstString(metadata.collection);

  const releaseYear = Number.isInteger(year) && year > 1800 ? year : null;
  const oldEnoughForPublicDomain = releaseYear !== null && releaseYear <= PUBLIC_DOMAIN_YEAR_CUTOFF;
  const rightsVerified = Boolean(licenseUrl) || oldEnoughForPublicDomain;

  const rightsBasis = licenseUrl
    ? `licença declarada: ${licenseUrl}`
    : oldEnoughForPublicDomain
      ? `publicado em ${releaseYear}, anterior ao corte de ${PUBLIC_DOMAIN_YEAR_CUTOFF} usado aqui`
      : "SEM licença declarada e sem ano que garanta domínio público";

  return {
    identifier,
    title: firstString(metadata.title) || identifier,
    description: stripHtml(firstString(metadata.description)) || "Sem descrição disponível.",
    releaseYear,
    videoUrl: `${DOWNLOAD_ENDPOINT}/${encodeURIComponent(identifier)}/${encodeURIComponent(videoFile.name)}`,
    posterUrl: `${THUMBNAIL_ENDPOINT}/${encodeURIComponent(identifier)}`,
    durationSeconds: parseLength(videoFile.length),
    rightsVerified,
    licenseNote: [
      `Internet Archive: item "${identifier}"`,
      collections ? `coleções: ${collections}` : "",
      rightsBasis,
      "Situação de direitos varia por país — confirme na sua jurisdição antes de publicar.",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
