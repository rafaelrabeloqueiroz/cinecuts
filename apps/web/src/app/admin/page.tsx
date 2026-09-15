import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/admin";
import { prisma } from "@cinecuts/db";

export default async function AdminDashboard() {
  const session = await requireAdminSession();
  if (!session) redirect("/login");

  const movies = await prisma.movie.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clips: true } } },
  });

  return (
    <main className="min-h-screen px-6 py-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Admin — Catálogo</h1>
        <Link href="/admin/filmes/novo" className="bg-brand px-4 py-2 rounded-md font-semibold">
          + Novo filme
        </Link>
      </div>

      <table className="w-full text-left">
        <thead className="text-white/50 text-sm">
          <tr>
            <th className="py-2">Título</th>
            <th className="py-2">Status</th>
            <th className="py-2">Clipes</th>
          </tr>
        </thead>
        <tbody>
          {movies.map((movie) => (
            <tr key={movie.id} className="border-t border-white/10">
              <td className="py-3">
                <Link href={`/admin/filmes/${movie.id}`} className="hover:underline">
                  {movie.title}
                </Link>
              </td>
              <td className="py-3 text-white/70">{movie.status}</td>
              <td className="py-3 text-white/70">{movie._count.clips}</td>
            </tr>
          ))}
          {movies.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-white/50">
                Nenhum filme cadastrado ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
