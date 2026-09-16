import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { userHasActiveSubscription } from "@/lib/subscription";
import { prisma } from "@cinecuts/db";
import { movieVideoUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function MoviePage({ params }: { params: { slug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  const active = await userHasActiveSubscription(userId);
  if (!active) redirect("/assinar");

  const movie = await prisma.movie.findUnique({ where: { slug: params.slug } });
  if (!movie || movie.status !== "PUBLISHED") notFound();

  // Só chega aqui quem tem assinatura ativa. Para arquivos no nosso storage a
  // URL é assinada e de curta duração, então não vira link compartilhável.
  const videoUrl = await movieVideoUrl(movie);

  return (
    <main className="min-h-screen px-6 py-10 max-w-4xl mx-auto">
      <Link href="/catalogo" className="text-white/50 hover:text-white text-sm">
        ← Voltar ao catálogo
      </Link>

      {videoUrl ? (
        <video controls controlsList="nodownload" className="w-full rounded-lg bg-black mt-4" src={videoUrl} />
      ) : (
        <div className="w-full aspect-video rounded-lg bg-black mt-4 flex items-center justify-center text-white/40">
          Arquivo de vídeo indisponível
        </div>
      )}

      <h1 className="text-3xl font-bold mt-6">{movie.title}</h1>
      {movie.releaseYear && <p className="text-white/50">{movie.releaseYear}</p>}
      <p className="text-white/70 mt-4 whitespace-pre-wrap">{movie.description}</p>

      {/* Licenças CC BY / BY-SA exigem crédito visível a quem assiste. */}
      {movie.attributionText && (
        <p className="text-white/60 text-sm mt-5 border-l-2 border-brand pl-3">
          {movie.attributionText}
        </p>
      )}

      <p className="text-white/30 text-xs mt-6 border-t border-white/10 pt-4">
        Situação de direitos: {movie.publicDomainNotes}
      </p>
    </main>
  );
}
