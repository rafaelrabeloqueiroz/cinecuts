import { startGenerateClipWorker } from "./jobs/generateClip";
import { startPostToInstagramWorker } from "./jobs/postToInstagram";
import { startScheduler } from "./scheduler";

const clipWorker = startGenerateClipWorker();
const postWorker = startPostToInstagramWorker();
const schedulerHandle = startScheduler();

console.log("CineCuts worker rodando: geração de clipes + agendador de posts no Instagram.");

async function shutdown() {
  clearInterval(schedulerHandle);
  await Promise.all([clipWorker.close(), postWorker.close()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
