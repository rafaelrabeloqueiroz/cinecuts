import { Worker, type Job } from "bullmq";
import { prisma } from "@cinecuts/db";
import { storage } from "@cinecuts/storage";
import { connection, SOCIAL_POSTING_QUEUE, type PostClipJobData } from "../lib/queue";
import {
  createReelsContainer,
  waitForContainerReady,
  publishContainer,
  isInstagramConfigured,
} from "../lib/instagram";

async function processPostToInstagram(job: Job<PostClipJobData>) {
  const { socialPostId } = job.data;

  const socialPost = await prisma.socialPost.findUniqueOrThrow({
    where: { id: socialPostId },
    include: { clip: true },
  });

  if (!socialPost.clip.storageKey) {
    throw new Error("Clipe ainda não está pronto (sem storageKey)");
  }

  await prisma.socialPost.update({ where: { id: socialPostId }, data: { status: "POSTING", errorMessage: null } });

  try {
    const videoUrl = await storage.getPlaybackUrl(socialPost.clip.storageKey);

    let externalPostId: string;
    if (isInstagramConfigured()) {
      const containerId = await createReelsContainer(videoUrl, socialPost.caption);
      await waitForContainerReady(containerId);
      externalPostId = await publishContainer(containerId);
    } else {
      // Sem credenciais da Graph API: simula a publicação para o fluxo poder ser
      // testado ponta a ponta. Basta preencher o .env para virar publicação real.
      console.log(`[demo] Publicaria no Instagram: ${videoUrl}\n${socialPost.caption}`);
      externalPostId = `demo_${socialPost.id}`;
    }

    await prisma.socialPost.update({
      where: { id: socialPostId },
      data: { status: "POSTED", postedAt: new Date(), externalPostId },
    });
  } catch (err) {
    await prisma.socialPost.update({
      where: { id: socialPostId },
      data: { status: "FAILED", errorMessage: (err as Error).message },
    });
    throw err;
  }
}

export function startPostToInstagramWorker() {
  return new Worker<PostClipJobData>(SOCIAL_POSTING_QUEUE, processPostToInstagram, {
    connection,
    concurrency: 1,
  });
}
