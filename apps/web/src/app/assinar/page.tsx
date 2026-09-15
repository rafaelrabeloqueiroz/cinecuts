"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SubscribePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubscribe() {
    if (status !== "authenticated") {
      router.push("/login");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const body = await res.json();
    setLoading(false);
    if (body.url) window.location.href = body.url;
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6">
      <h1 className="text-3xl font-bold">Assine o CineCuts</h1>
      <div className="bg-white/5 rounded-xl p-8 max-w-md">
        <p className="text-4xl font-bold mb-2">R$ 19,90/mês</p>
        <ul className="text-white/70 text-left list-disc list-inside mb-6 space-y-1">
          <li>Catálogo completo de clássicos em domínio público</li>
          <li>Sem anúncios</li>
          <li>Cancele quando quiser</li>
        </ul>
        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="bg-brand w-full rounded-md px-4 py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "Redirecionando..." : "Assinar agora"}
        </button>
      </div>
      {session?.user && (
        <p className="text-white/50 text-sm">Logado como {session.user.email}</p>
      )}
    </main>
  );
}
