import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { userHasActiveSubscription } from "@/lib/subscription";
import { prisma } from "@cinecuts/db";
import { publicUrlFor, createDownloadUrl } from "@/lib/storage";

export default async function MoviePage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  const active = await userHasActiveSubscription(userId);
  if (!active) redirect("/assinar");

  const movie = await prisma.movie.findUnique({ where: { slug: params.slug } });
  if (!movie || movie.status !== "PUBLISHED") notFound();

  // URL assinada e de curta duração: só quem tem assinatura ativa chega até
  // aqui, e o link não pode ser compartilhado/reaproveitado depois de expirar.
  const videoUrl = await createDownloadUrl(movie.videoStorageKey);

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <video
        controls
        controlsList="nodownload"
        className="w-full rounded-lg bg-black"
        src={videoUrl}
      />
      <h1 className="text-3xl font-bold mt-6">{movie.title}</h1>
      {movie.releaseYear && <p className="text-white/50">{movie.releaseYear}</p>}
      <p className="text-white/70 mt-4">{movie.description}</p>
      <p className="text-white/30 text-xs mt-6">{movie.publicDomainNotes}</p>
    </main>
  );
}
