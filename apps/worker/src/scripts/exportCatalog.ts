import "../lib/env";
import { writeFileSync } from "node:fs";
import { prisma } from "@cinecuts/db";

/** Exporta o catálogo publicado como JSON (útil para protótipos e backups). */
async function main() {
  const outputPath = process.argv[2] ?? "catalogo.json";

  const movies = await prisma.movie.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { durationSeconds: "desc" },
    select: {
      title: true,
      slug: true,
      releaseYear: true,
      description: true,
      externalVideoUrl: true,
      externalPosterUrl: true,
      durationSeconds: true,
      publicDomainNotes: true,
      attributionText: true,
      archiveIdentifier: true,
    },
  });

  writeFileSync(outputPath, JSON.stringify(movies, null, 2));
  console.log(`${movies.length} filmes exportados para ${outputPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
