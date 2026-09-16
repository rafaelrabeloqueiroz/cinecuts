"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscribePanel({
  demoMode,
  authenticated,
  email,
}: {
  demoMode: boolean;
  authenticated: boolean;
  email: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStripeCheckout() {
    if (!authenticated) {
      router.push("/login");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setLoading(false);

    if (body.url) {
      window.location.href = body.url;
      return;
    }
    setError(body.error ?? "Checkout do Stripe não está configurado neste ambiente.");
  }

  async function handleDemoSubscribe() {
    if (!authenticated) {
      router.push("/login");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/demo/subscribe", { method: "POST" });
    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Não foi possível ativar a assinatura de teste");
      return;
    }
    router.push("/catalogo");
    router.refresh();
  }

  return (
    <div className="bg-white/5 rounded-xl p-8 max-w-md w-full">
      <p className="text-4xl font-bold mb-2">R$ 19,90/mês</p>
      <ul className="text-white/70 text-left list-disc list-inside mb-6 space-y-1">
        <li>Catálogo completo de clássicos em domínio público</li>
        <li>Sem anúncios</li>
        <li>Cancele quando quiser</li>
      </ul>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <button
        onClick={handleStripeCheckout}
        disabled={loading}
        className="bg-brand w-full rounded-md px-4 py-3 font-semibold disabled:opacity-50"
      >
        {loading ? "Aguarde..." : "Assinar com cartão"}
      </button>

      {demoMode && (
        <>
          <div className="flex items-center gap-3 my-5 text-white/30 text-xs">
            <span className="h-px bg-white/15 flex-1" />
            MODO DEMO
            <span className="h-px bg-white/15 flex-1" />
          </div>
          <button
            onClick={handleDemoSubscribe}
            disabled={loading}
            className="border border-white/25 w-full rounded-md px-4 py-3 font-semibold hover:bg-white/10 disabled:opacity-50"
          >
            Ativar assinatura de teste (sem pagamento)
          </button>
          <p className="text-white/40 text-xs mt-3">
            O botão acima libera o catálogo por 30 dias sem cobrar nada. O pagamento real via
            Stripe só funciona depois de configurar as chaves no .env.
          </p>
        </>
      )}

      {email && <p className="text-white/40 text-xs mt-4">Logado como {email}</p>}
      {!authenticated && (
        <p className="text-white/40 text-xs mt-4">Você precisa entrar antes de assinar.</p>
      )}
    </div>
  );
}
