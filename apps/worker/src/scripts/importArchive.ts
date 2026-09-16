import "../lib/env";
import { prisma } from "@cinecuts/db";
import { searchCollection, resolveItem } from "../lib/archive";

type Options = {
  collection: string;
  limit: number;
  publish: boolean;
  allowUnverified: boolean;
  minYear: number | null;
  maxYear: number | null;
};

function parseArgs(argv: string[]): Options {
  // Recorte padrão: era de ouro de Hollywood cujo copyright não foi renovado.
  // São os títulos mais "assistíveis" que ainda são livres — com som, estrelas
  // conhecidas e, às vezes, cor. Nada posterior a isso é domínio público.
  const options: Options = {
    collection: "feature_films",
    limit: 60,
    publish: false,
    allowUnverified: false,
    minYear: 1930,
    maxYear: 1975,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--collection") options.collection = argv[++i] ?? options.collection;
    else if (arg === "--limit") options.limit = Number(argv[++i] ?? options.limit);
    else if (arg === "--publish") options.publish = true;
    else if (arg === "--allow-unverified") options.allowUnverified = true;
    else if (arg === "--min-year") options.minYear = Number(argv[++i]);
    else if (arg === "--max-year") options.maxYear = Number(argv[++i]);
    else if (arg === "--any-year") { options.minYear = null; options.maxYear = null; }
  }

  return options;
}

/**
 * O acervo mistura clássicos com exploitation, pornografia de época e registros
 * reais de atrocidade — e a thumbnail do Archive é um frame arbitrário do filme.
 * Cada padrão abaixo veio de um item que realmente apareceu numa importação.
 * É uma primeira barreira: revisão humana antes de publicar continua sendo
 * obrigatória, e é por isso que o import entra como DRAFT por padrão.
 */
const CONTENT_BLOCKLIST: Array<{ reason: string; pattern: RegExp }> = [
  {
    reason: "conteúdo sexual/exploitation",
    pattern:
      /\b(orgy|orgia|nude|nudist|naked|erotic|er[óo]tic|sex|xxx|porn|adult film|burlesque|striptease|teaserama|child bride|vice racket)/i,
  },
  {
    reason: "registro real de atrocidade",
    pattern: /\b(concentration camp|holocaust|atrocities|mass grave|execution footage)/i,
  },
  {
    reason: "propaganda racista",
    pattern: /\b(birth of a nation|ku klux|klansman)/i,
  },
];

function blockedReason(title: string, description: string): string | null {
  const haystack = `${title} ${description}`;
  const hit = CONTENT_BLOCKLIST.find((rule) => rule.pattern.test(haystack));
  return hit ? hit.reason : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string, identifier: string): Promise<string> {
  const candidate = base || slugify(identifier);
  const existing = await prisma.movie.findUnique({ where: { slug: candidate } });
  if (!existing || existing.archiveIdentifier === identifier) return candidate;
  return `${candidate}-${slugify(identifier)}`.slice(0, 100);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rowsPerPage = 50;

  const faixa =
    options.minYear || options.maxYear
      ? ` (${options.minYear ?? "?"}–${options.maxYear ?? "?"})`
      : "";
  console.log(
    `Importando até ${options.limit} filmes da coleção "${options.collection}"${faixa} do Internet Archive...`
  );

  let imported = 0;
  let skipped = 0;
  let page = 1;

  while (imported < options.limit) {
    const { docs, numFound } = await searchCollection(options.collection, page, rowsPerPage, {
      minYear: options.minYear,
      maxYear: options.maxYear,
      // Fora da faixa em que a idade por si só garante domínio público, só
      // aceitamos item que declare licença — é o que separa o acervo legítimo
      // dos uploads de filmes ainda protegidos.
      requireLicense: !options.allowUnverified,
    });
    if (docs.length === 0) break;
    if (page === 1) console.log(`Itens encontrados na coleção: ${numFound}`);

    for (const doc of docs) {
      if (imported >= options.limit) break;

      const item = await resolveItem(doc.identifier).catch(() => null);
      if (!item || item.durationSeconds <= 0) {
        skipped++;
        console.warn(`  ignorado: ${doc.identifier} (sem vídeo mp4 utilizável ou duração desconhecida)`);
        continue;
      }

      if (!item.rightsVerified && !options.allowUnverified) {
        skipped++;
        console.warn(`  ignorado: ${item.title} (sem licença declarada nem ano que garanta domínio público)`);
        continue;
      }

      const blocked = blockedReason(item.title, item.description);
      if (blocked) {
        skipped++;
        console.warn(`  ignorado: ${item.title} (${blocked})`);
        continue;
      }

      const slug = await uniqueSlug(slugify(item.title), item.identifier);

      await prisma.movie.upsert({
        where: { archiveIdentifier: item.identifier },
        create: {
          title: item.title,
          slug,
          description: item.description.slice(0, 2000),
          releaseYear: item.releaseYear,
          publicDomainNotes: item.licenseNote,
          externalVideoUrl: item.videoUrl,
          externalPosterUrl: item.posterUrl,
          archiveIdentifier: item.identifier,
          durationSeconds: item.durationSeconds,
          status: options.publish ? "PUBLISHED" : "DRAFT",
        },
        update: {
          title: item.title,
          description: item.description.slice(0, 2000),
          releaseYear: item.releaseYear,
          publicDomainNotes: item.licenseNote,
          externalVideoUrl: item.videoUrl,
          externalPosterUrl: item.posterUrl,
          durationSeconds: item.durationSeconds,
        },
      });

      imported++;
      console.log(`  ✓ ${item.title} (${item.releaseYear ?? "s/ano"})`);
    }

    page++;
  }

  console.log(`\nConcluído: ${imported} importados, ${skipped} ignorados.`);
  if (!options.publish) {
    console.log('Os filmes entraram como DRAFT. Publique pelo /admin ou rode de novo com "--publish".');
  }
}

main()
  .catch((err) => {
    console.error("Falha na importação:", err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
