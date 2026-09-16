import Link from "next/link";
import { prisma } from "@cinecuts/db";
import { moviePosterUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const movies = await prisma.movie.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const withPosters = await Promise.all(
    movies.map(async (movie) => ({ movie, posterUrl: await moviePosterUrl(movie) }))
  );

  return (
    <main className="min-h-screen">
      <section className="px-6 pt-24 pb-16 max-w-4xl mx-auto text-center flex flex-col items-center gap-6">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">CineCuts</h1>
        <p className="max-w-xl text-white/70 text-lg">
          Clássicos do cinema em domínio público, sem anúncios, em qualquer dispositivo.
          Assine e tenha acesso ilimitado ao catálogo completo.
        </p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/assinar" className="bg-brand px-8 py-3 rounded-md font-semibold hover:opacity-90">
            Assinar agora
          </Link>
          <Link href="/login" className="border border-white/25 px-8 py-3 rounded-md font-semibold hover:bg-white/10">
            Entrar
          </Link>
        </div>
      </section>

      {withPosters.length > 0 && (
        <section className="px-6 pb-24 max-w-6xl mx-auto">
          <h2 className="text-sm uppercase tracking-widest text-white/40 mb-5 text-center">
            No catálogo
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {withPosters.map(({ movie, posterUrl }) => (
              <div key={movie.id} className="aspect-[2/3] bg-white/10 rounded-md overflow-hidden">
                {posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={posterUrl} alt={movie.title} className="w-full h-full object-cover opacity-80" />
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
