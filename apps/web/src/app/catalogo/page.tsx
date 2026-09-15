import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { userHasActiveSubscription } from "@/lib/subscription";
import { prisma } from "@cinecuts/db";
import { publicUrlFor } from "@/lib/storage";

export default async function CatalogPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const userId = (session.user as { id: string }).id;
  const active = await userHasActiveSubscription(userId);
  if (!active) redirect("/assinar");

  const movies = await prisma.movie.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen px-6 py-10">
      <h1 className="text-3xl font-bold mb-8">Catálogo</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {movies.map((movie) => (
          <Link key={movie.id} href={`/filme/${movie.slug}`} className="group">
            <div className="aspect-[2/3] bg-white/10 rounded-md overflow-hidden">
              {movie.posterStorageKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={publicUrlFor(movie.posterStorageKey)}
                  alt={movie.title}
                  className="w-full h-full object-cover group-hover:opacity-80"
                />
              )}
            </div>
            <p className="mt-2 text-sm text-white/80">{movie.title}</p>
          </Link>
        ))}
        {movies.length === 0 && (
          <p className="text-white/50 col-span-full">Nenhum filme publicado ainda.</p>
        )}
      </div>
    </main>
  );
}
