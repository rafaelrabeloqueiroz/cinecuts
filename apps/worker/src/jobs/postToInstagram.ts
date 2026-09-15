import { Worker, type Job } from "bullmq";
import { prisma } from "@cinecuts/db";
import { connection, SOCIAL_POSTING_QUEUE, type PostClipJobData } from "../lib/queue";
import { publicUrlFor } from "../lib/storage";
import { createReelsContainer, waitForContainerReady, publishContainer } from "../lib/instagram";

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
    const videoUrl = publicUrlFor(socialPost.clip.storageKey);
    const containerId = await createReelsContainer(videoUrl, socialPost.caption);
    await waitForContainerReady(containerId);
    const externalPostId = await publishContainer(containerId);

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
