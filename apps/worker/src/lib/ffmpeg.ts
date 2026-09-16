import ffmpeg from "fluent-ffmpeg";

/** Corta [startSeconds, endSeconds) de `inputPath` (arquivo local ou URL http) e grava em `outputPath` como MP4 h264/aac, formato aceito pelo Reels. */
export function cutClip(inputPath: string, outputPath: string, startSeconds: number, endSeconds: number): Promise<void> {
  const duration = endSeconds - startSeconds;
  if (duration <= 0) {
    return Promise.reject(new Error("endSeconds deve ser maior que startSeconds"));
  }

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startSeconds)
      .duration(duration)
      .videoCodec("libx264")
      .audioCodec("aac")
      .outputOptions(["-preset veryfast", "-movflags +faststart"])
      .on("error", reject)
      .on("end", () => resolve())
      .save(outputPath);
  });
}
