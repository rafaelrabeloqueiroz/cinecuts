"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("E-mail ou senha inválidos");
      return;
    }
    router.push("/catalogo");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Entrar</h1>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <input
          type="email"
          required
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-white/10 rounded-md px-4 py-2 outline-none"
        />
        <input
          type="password"
          required
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="bg-white/10 rounded-md px-4 py-2 outline-none"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-brand rounded-md px-4 py-2 font-semibold disabled:opacity-50"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <p className="text-white/60 text-sm">
          Não tem conta?{" "}
          <Link href="/registrar" className="underline">
            Criar conta
          </Link>
        </p>
      </form>
    </main>
  );
}
