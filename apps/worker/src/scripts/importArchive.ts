import "../lib/env";
import { prisma } from "@cinecuts/db";
import { searchCollection, resolveItem } from "../lib/archive";

type Options = {
  collection: string;
  limit: number;
  publish: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { collection: "feature_films", limit: 60, publish: false };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--collection") options.collection = argv[++i] ?? options.collection;
    else if (arg === "--limit") options.limit = Number(argv[++i] ?? options.limit);
    else if (arg === "--publish") options.publish = true;
  }

  return options;
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

  console.log(
    `Importando até ${options.limit} filmes da coleção "${options.collection}" do Internet Archive...`
  );

  let imported = 0;
  let skipped = 0;
  let page = 1;

  while (imported < options.limit) {
    const { docs, numFound } = await searchCollection(options.collection, page, rowsPerPage);
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
