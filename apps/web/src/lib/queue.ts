import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const clipGenerationQueue = new Queue("clip-generation", { connection });
export const socialPostingQueue = new Queue("social-posting", { connection });
