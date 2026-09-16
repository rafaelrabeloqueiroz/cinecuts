import { redirect, notFound } from "next/navigation";
import { storage } from "@cinecuts/storage";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@cinecuts/db";
import ClipManager from "./clip-manager";
import PublishToggle from "./publish-toggle";

export const dynamic = "force-dynamic";

export default async function MovieAdminPage({ params }: { params: { id: string } }) {
  const session = await requireAdminSession();
  if (!session) redirect("/login");

  const movie = await prisma.movie.findUnique({
    where: { id: params.id },
    include: { clips: { include: { socialPosts: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!movie) notFound();

  const clips = await Promise.all(
    movie.clips.map(async (clip) => ({
      ...clip,
      previewUrl: clip.storageKey ? await storage.getPlaybackUrl(clip.storageKey) : null,
      socialPosts: clip.socialPosts.map((post) => ({
        ...post,
        scheduledFor: post.scheduledFor.toISOString(),
      })),
    }))
  );

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{movie.title}</h1>
          <p className="text-white/50 text-sm mt-1">Status: {movie.status}</p>
        </div>
        <PublishToggle movieId={movie.id} status={movie.status} />
      </div>

      <p className="text-white/70 mt-4">{movie.description}</p>

      <ClipManager
        movieId={movie.id}
        movieTitle={movie.title}
        releaseYear={movie.releaseYear}
        clips={clips}
      />
    </main>
  );
}
