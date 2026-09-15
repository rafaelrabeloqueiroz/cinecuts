import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

export async function createUploadUrl(storageKey: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: storageKey,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: 60 * 10 });
}

export async function createDownloadUrl(storageKey: string) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: storageKey });
  return getSignedUrl(s3, command, { expiresIn: 60 * 10 });
}
