import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <h1 className="text-4xl md:text-6xl font-bold">CineCuts</h1>
      <p className="max-w-xl text-white/70">
        Clássicos do cinema em domínio público, sem anúncios, em qualquer dispositivo.
        Assine e tenha acesso ilimitado ao catálogo completo.
      </p>
      <div className="flex gap-4">
        <Link href="/assinar" className="bg-brand px-6 py-3 rounded-md font-semibold hover:opacity-90">
          Assinar agora
        </Link>
        <Link href="/login" className="border border-white/30 px-6 py-3 rounded-md font-semibold hover:bg-white/10">
          Entrar
        </Link>
      </div>
    </main>
  );
}
