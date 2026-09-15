import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { readFile } from "node:fs/promises";

export const s3 = new S3Client({
  region: process.env.STORAGE_REGION ?? "auto",
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? "",
  },
});

const BUCKET = process.env.STORAGE_BUCKET ?? "cinecuts-media";

export function publicUrlFor(storageKey: string): string {
  const base = process.env.STORAGE_PUBLIC_BASE_URL ?? "";
  return `${base.replace(/\/$/, "")}/${storageKey.replace(/^\//, "")}`;
}

export async function downloadToFile(storageKey: string, destPath: string): Promise<void> {
  const response = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: storageKey }));
  const body = response.Body;
  if (!body) throw new Error(`Objeto vazio: ${storageKey}`);
  await pipeline(body as NodeJS.ReadableStream, createWriteStream(destPath));
}

export async function uploadFile(storageKey: string, localPath: string, contentType: string): Promise<void> {
  const fileBuffer = await readFile(localPath);
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: storageKey,
      Body: fileBuffer,
      ContentType: contentType,
    })
  );
}
