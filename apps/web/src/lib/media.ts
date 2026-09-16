import { storage } from "@cinecuts/storage";

type MovieMediaFields = {
  videoStorageKey: string | null;
  externalVideoUrl: string | null;
  posterStorageKey: string | null;
  externalPosterUrl: string | null;
};

/** URL de reprodução do filme: fonte externa (ex.: Internet Archive) ou objeto no nosso storage. */
export async function movieVideoUrl(movie: MovieMediaFields): Promise<string | null> {
  if (movie.externalVideoUrl) return movie.externalVideoUrl;
  if (movie.videoStorageKey) return storage.getPlaybackUrl(movie.videoStorageKey);
  return null;
}

export async function moviePosterUrl(movie: MovieMediaFields): Promise<string | null> {
  if (movie.externalPosterUrl) return movie.externalPosterUrl;
  if (movie.posterStorageKey) return storage.getPlaybackUrl(movie.posterStorageKey);
  return null;
}
