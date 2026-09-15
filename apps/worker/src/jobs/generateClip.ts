import { Worker, type Job } from "bullmq";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@cinecuts/db";
import { connection, CLIP_GENERATION_QUEUE, type GenerateClipJobData } from "../lib/queue";
import { downloadToFile, uploadFile } from "../lib/storage";
import { cutClip } from "../lib/ffmpeg";

async function processGenerateClip(job: Job<GenerateClipJobData>) {
  const { clipId } = job.data;

  const clip = await prisma.clip.findUniqueOrThrow({
    where: { id: clipId },
    include: { movie: true },
  });

  await prisma.clip.update({ where: { id: clipId }, data: { status: "PROCESSING", errorMessage: null } });

  const workDir = await mkdtemp(join(tmpdir(), "cinecuts-clip-"));
  const sourcePath = join(workDir, "source.mp4");
  const outputPath = join(workDir, "clip.mp4");

  try {
    await downloadToFile(clip.movie.videoStorageKey, sourcePath);
    await cutClip(sourcePath, outputPath, clip.startSeconds, clip.endSeconds);

    const storageKey = `clips/${clip.movieId}/${clip.id}.mp4`;
    await uploadFile(storageKey, outputPath, "video/mp4");

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
