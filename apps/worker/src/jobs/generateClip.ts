import { Worker, type Job } from "bullmq";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@cinecuts/db";
import { storage } from "@cinecuts/storage";
import { connection, CLIP_GENERATION_QUEUE, type GenerateClipJobData } from "../lib/queue";
import { cutClip } from "../lib/ffmpeg";

async function processGenerateClip(job: Job<GenerateClipJobData>) {
  const { clipId } = job.data;

  const clip = await prisma.clip.findUniqueOrThrow({
    where: { id: clipId },
    include: { movie: true },
  });

  await prisma.clip.update({ where: { id: clipId }, data: { status: "PROCESSING", errorMessage: null } });

  const workDir = await mkdtemp(join(tmpdir(), "cinecuts-clip-"));
  const outputPath = join(workDir, "clip.mp4");

  try {
    // Filmes vindos de fonte externa (Internet Archive) são lidos direto pela
    // URL; o ffmpeg faz range requests e busca só o trecho pedido.
    let inputPath: string;
    if (clip.movie.externalVideoUrl) {
      inputPath = clip.movie.externalVideoUrl;
    } else if (clip.movie.videoStorageKey) {
      inputPath = join(workDir, "source.mp4");
      await storage.downloadToFile(clip.movie.videoStorageKey, inputPath);
    } else {
      throw new Error("Filme sem arquivo de vídeo (nem storage nem URL externa)");
    }

    await cutClip(inputPath, outputPath, clip.startSeconds, clip.endSeconds);

    const storageKey = `clips/${clip.movieId}/${clip.id}.mp4`;
    await storage.uploadFromFile(storageKey, outputPath, "video/mp4");

    await prisma.clip.update({
      where: { id: clipId },
      data: { status: "READY", storageKey },
    });
  } catch (err) {
    await prisma.clip.update({
      where: { id: clipId },
      data: { status: "FAILED", errorMessage: (err as Error).message },
    });
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

export function startGenerateClipWorker() {
  return new Worker<GenerateClipJobData>(CLIP_GENERATION_QUEUE, processGenerateClip, {
    connection,
    concurrency: 2,
  });
}
