import { prisma } from "@cinecuts/db";
import { socialPostingQueue } from "./lib/queue";

const POLL_INTERVAL_MS = 60_000;

/** A cada minuto, procura SocialPost SCHEDULED cujo horário já chegou e enfileira a publicação. */
export function startScheduler() {
  async function tick() {
    const due = await prisma.socialPost.findMany({
      where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
      take: 20,
    });

    for (const post of due) {
      await socialPostingQueue.add("post", { socialPostId: post.id }, { jobId: post.id, attempts: 3, backoff: { type: "exponential", delay: 60_000 } });
    }
  }

  tick().catch((err) => console.error("Erro no scheduler:", err));
  return setInterval(() => tick().catch((err) => console.error("Erro no scheduler:", err)), POLL_INTERVAL_MS);
}
