import "../lib/env";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import ffmpeg from "fluent-ffmpeg";
import { prisma } from "@cinecuts/db";
import { storage } from "@cinecuts/storage";

/**
 * Popula o catálogo com clássicos de domínio público reais (metadados corretos),
 * porém com arquivos de vídeo gerados localmente como amostra. Serve para ver o
 * produto funcionando sem depender de rede nem de storage externo; para trazer os
 * arquivos reais, rode `npm run import:archive -w apps/worker`.
 */

type DemoMovie = {
  title: string;
  slug: string;
  releaseYear: number;
  description: string;
  color: string;
  durationSeconds: number;
};

const DEMO_MOVIES: DemoMovie[] = [
  {
    title: "Nosferatu",
    slug: "nosferatu",
    releaseYear: 1922,
    description:
      "Adaptação não autorizada de Drácula dirigida por F. W. Murnau. O corretor Thomas Hutter viaja aos Cárpatos para fechar negócio com o conde Orlok e desperta uma praga que segue seu rastro até Wisborg.",
    color: "0x14141e",
    durationSeconds: 94,
  },
  {
    title: "O Gabinete do Dr. Caligari",
    slug: "o-gabinete-do-dr-caligari",
    releaseYear: 1920,
    description:
      "Marco do expressionismo alemão. Um hipnotizador de feira exibe um sonâmbulo que prevê mortes, e a cidade de Holstenwall começa a colecionar cadáveres.",
    color: "0x1b1524",
    durationSeconds: 76,
  },
  {
    title: "A Viagem à Lua",
    slug: "a-viagem-a-lua",
    releaseYear: 1902,
    description:
      "O curta de Georges Méliès que inventou o cinema de ficção científica: um grupo de astrônomos é lançado à Lua dentro de uma cápsula de canhão.",
    color: "0x101c2c",
    durationSeconds: 13,
  },
  {
    title: "Tempos Modernos do Trabalho",
    slug: "tempos-modernos-do-trabalho",
    releaseYear: 1936,
    description:
      "Comédia sobre a linha de montagem e a mecanização do trabalho, com um operário engolido pelas engrenagens da fábrica moderna.",
    color: "0x241a12",
    durationSeconds: 87,
  },
  {
    title: "A Noite dos Mortos-Vivos",
    slug: "a-noite-dos-mortos-vivos",
    releaseYear: 1968,
    description:
      "O filme de George A. Romero que criou o zumbi moderno. Sete pessoas se barricam numa casa de fazenda na Pensilvânia enquanto os mortos se levantam.",
    color: "0x0f1410",
    durationSeconds: 96,
  },
  {
    title: "O Homem com uma Câmera",
    slug: "o-homem-com-uma-camera",
    releaseYear: 1929,
    description:
      "Documentário experimental de Dziga Vertov que retrata um dia numa cidade soviética e, ao mesmo tempo, o próprio ato de filmar e montar.",
    color: "0x1a1a1a",
    durationSeconds: 68,
  },
  {
    title: "Metropolis",
    slug: "metropolis",
    releaseYear: 1927,
    description:
      "Na megalópole dividida entre a cidade alta dos planejadores e a cidade baixa dos operários, o filho do governante se apaixona por Maria e descobre o custo humano da máquina.",
    color: "0x121a26",
    durationSeconds: 153,
  },
  {
    title: "O Garoto",
    slug: "o-garoto",
    releaseYear: 1921,
    description:
      "Um vagabundo encontra um bebê abandonado e o cria como filho, até que as autoridades decidem separá-los. Primeiro longa dirigido por Charles Chaplin.",
    color: "0x22201a",
    durationSeconds: 68,
  },
  {
    title: "O Encouraçado Potemkin",
    slug: "o-encouracado-potemkin",
    releaseYear: 1925,
    description:
      "A revolta dos marinheiros do Potemkin contra os oficiais czaristas, com a célebre sequência da escadaria de Odessa montada por Sergei Eisenstein.",
    color: "0x1c1416",
    durationSeconds: 75,
  },
  {
    title: "A Grande Assalto ao Trem",
    slug: "a-grande-assalto-ao-trem",
    releaseYear: 1903,
    description:
      "Um dos primeiros faroestes narrativos: bandidos assaltam um trem, fogem para a mata e são perseguidos por uma patrulha improvisada.",
    color: "0x241c14",
    durationSeconds: 12,
  },
  {
    title: "Sherlock Filho",
    slug: "sherlock-filho",
    releaseYear: 1924,
    description:
      "Um projecionista de cinema sonha em ser detetive e literalmente entra na tela do filme que projeta. Comédia acrobática de Buster Keaton.",
    color: "0x1e1a24",
    durationSeconds: 45,
  },
  {
    title: "Carnaval das Almas",
    slug: "carnaval-das-almas",
    releaseYear: 1962,
    description:
      "Única sobrevivente de um acidente de carro, uma organista se muda para Utah e passa a ser perseguida por uma figura pálida e por um parque de diversões abandonado.",
    color: "0x161a1c",
    durationSeconds: 78,
  },
];

const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
];

function findFont(): string | null {
  return FONT_CANDIDATES.find((path) => existsSync(path)) ?? null;
}

/** drawtext usa `:` e `'` como sintaxe, então precisam ser neutralizados. */
function escapeDrawText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "");
}

/** drawtext não quebra linha sozinho: títulos longos estouram a largura do quadro. */
function wrapTitle(title: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  let current = "";

  for (const word of title.toUpperCase().split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  return lines;
}

/** Uma chamada de drawtext por linha, centralizada horizontalmente. */
function titleFilters(
  font: string,
  title: string,
  options: { maxChars: number; fontSize: number; firstLineY: string; lineHeight: number }
): string[] {
  return wrapTitle(title, options.maxChars).map((line, index) => {
    const y = `${options.firstLineY}+${index * options.lineHeight}`;
    return `drawtext=fontfile=${font}:text='${escapeDrawText(line)}':fontcolor=white:fontsize=${options.fontSize}:x=(w-text_w)/2:y=${y}`;
  });
}

function buildVideo(movie: DemoMovie, outputPath: string, seconds: number): Promise<void> {
  const font = findFont();
  const filters: string[] = [];

  if (font) {
    const lines = titleFilters(font, movie.title, {
      maxChars: 20,
      fontSize: 42,
      firstLineY: "h/2-70",
      lineHeight: 52,
    });
    const yearY = `h/2-70+${lines.length * 52}`;
    filters.push(
      ...lines,
      `drawtext=fontfile=${font}:text='${movie.releaseYear}':fontcolor=0x9a9aa8:fontsize=26:x=(w-text_w)/2:y=${yearY}`,
      `drawtext=fontfile=${font}:text='AMOSTRA DE DEMONSTRACAO':fontcolor=0x6a6a78:fontsize=18:x=(w-text_w)/2:y=h-50`
    );
  }
  filters.push("format=yuv420p");

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${movie.color}:s=854x480:r=24:d=${seconds}`)
      .inputFormat("lavfi")
      .input(`sine=frequency=180:duration=${seconds}`)
      .inputFormat("lavfi")
      .videoFilters(filters)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-preset ultrafast", "-movflags +faststart", "-shortest"])
      .on("error", reject)
      .on("end", () => resolve())
      .save(outputPath);
  });
}

function buildPoster(movie: DemoMovie, outputPath: string): Promise<void> {
  const font = findFont();
  const filters: string[] = [];

  if (font) {
    const lines = titleFilters(font, movie.title, {
      maxChars: 13,
      fontSize: 30,
      firstLineY: "h/2-90",
      lineHeight: 40,
    });
    const yearY = `h/2-90+${lines.length * 40 + 16}`;
    filters.push(
      ...lines,
      `drawtext=fontfile=${font}:text='${movie.releaseYear}':fontcolor=0x9a9aa8:fontsize=22:x=(w-text_w)/2:y=${yearY}`
    );
  }

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(`color=c=${movie.color}:s=400x600`)
      .inputFormat("lavfi")
      .frames(1)
      .videoFilters(filters)
      .on("error", reject)
      .on("end", () => resolve())
      .save(outputPath);
  });
}

async function main() {
  const publish = !process.argv.includes("--draft");
  const workDir = await mkdtemp(join(tmpdir(), "cinecuts-demo-"));

  console.log(`Gerando ${DEMO_MOVIES.length} filmes de demonstração...`);

  try {
    for (const movie of DEMO_MOVIES) {
      // Vídeo curto de amostra: o catálogo mostra a duração real do filme.
      const sampleSeconds = 60;
      const videoPath = join(workDir, `${movie.slug}.mp4`);
      const posterPath = join(workDir, `${movie.slug}.jpg`);

      await buildVideo(movie, videoPath, sampleSeconds);
      await buildPoster(movie, posterPath);

      const videoStorageKey = `movies/${movie.slug}/source.mp4`;
      const posterStorageKey = `movies/${movie.slug}/poster.jpg`;

      await storage.uploadFromFile(videoStorageKey, videoPath, "video/mp4");
      await storage.uploadFromFile(posterStorageKey, posterPath, "image/jpeg");

      await prisma.movie.upsert({
        where: { slug: movie.slug },
        create: {
          title: movie.title,
          slug: movie.slug,
          description: movie.description,
          releaseYear: movie.releaseYear,
          publicDomainNotes:
            "Título de domínio público (obra anterior à vigência de direitos autorais atuais ou com copyright não renovado). " +
            "ATENÇÃO: o arquivo de vídeo neste ambiente é uma amostra gerada localmente, não o filme real. " +
            "Use o importador do Internet Archive para trazer o arquivo verdadeiro e confirme a situação de direitos na sua jurisdição.",
          videoStorageKey,
          posterStorageKey,
          durationSeconds: sampleSeconds,
          status: publish ? "PUBLISHED" : "DRAFT",
        },
        update: {
          title: movie.title,
          description: movie.description,
          releaseYear: movie.releaseYear,
          videoStorageKey,
          posterStorageKey,
          durationSeconds: sampleSeconds,
          status: publish ? "PUBLISHED" : "DRAFT",
        },
      });

      console.log(`  ✓ ${movie.title} (${movie.releaseYear})`);
    }
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }

  console.log("\nCatálogo de demonstração pronto.");
}

main()
  .catch((err) => {
    console.error("Falha no seed de demonstração:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
