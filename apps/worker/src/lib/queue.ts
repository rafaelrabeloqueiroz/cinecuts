import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

export const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const CLIP_GENERATION_QUEUE = "clip-generation";
export const SOCIAL_POSTING_QUEUE = "social-posting";

export const clipGenerationQueue = new Queue(CLIP_GENERATION_QUEUE, { connection });
export const socialPostingQueue = new Queue(SOCIAL_POSTING_QUEUE, { connection });

export const clipGenerationEvents = new QueueEvents(CLIP_GENERATION_QUEUE, { connection });
export const socialPostingEvents = new QueueEvents(SOCIAL_POSTING_QUEUE, { connection });

export type GenerateClipJobData = { clipId: string };
export type PostClipJobData = { socialPostId: string };
