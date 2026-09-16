import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { userHasActiveSubscription } from "@/lib/subscription";
import { prisma } from "@cinecuts/db";
import { moviePosterUrl } from "@/lib/media";
import SignOutButton from "@/components/sign-out-button";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  const active = await userHasActiveSubscription(userId);
  if (!active) redirect("/assinar");

  const movies = await prisma.movie.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { title: "asc" },
  });

  const withPosters = await Promise.all(
    movies.map(async (movie) => ({ movie, posterUrl: await moviePosterUrl(movie) }))
  );

  const isAdmin = (session.user as { role?: string }).role === "ADMIN";

  return (
    <main className="min-h-screen px-6 py-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Catálogo</h1>
          <p className="text-white/50 text-sm mt-1">
            {movies.length} {movies.length === 1 ? "filme disponível" : "filmes disponíveis"}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          {isAdmin && (
            <Link href="/admin" className="text-white/70 hover:text-white underline">
              Admin
            </Link>
          )}
          <span className="text-white/50">{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
        {withPosters.map(({ movie, posterUrl }) => (
          <Link key={movie.id} href={`/filme/${movie.slug}`} className="group">
            <div className="aspect-[2/3] bg-white/10 rounded-md overflow-hidden relative">
              {posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover transition group-hover:scale-105 group-hover:opacity-80"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-xs p-2 text-center">
                  {movie.title}
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-white/80 group-hover:text-white line-clamp-2">{movie.title}</p>
            {movie.releaseYear && <p className="text-xs text-white/40">{movie.releaseYear}</p>}
          </Link>
        ))}
        {movies.length === 0 && (
          <p className="text-white/50 col-span-full">Nenhum filme publicado ainda.</p>
        )}
      </div>
    </main>
  );
}
