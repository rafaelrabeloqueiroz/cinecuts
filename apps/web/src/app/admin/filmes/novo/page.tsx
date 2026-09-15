"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uploadFile(file: File, kind: "movie" | "poster", slug: string) {
  const extension = file.name.split(".").pop() ?? "bin";
  const res = await fetch("/api/admin/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, slug, contentType: file.type, extension }),
  });
  const { uploadUrl, storageKey } = await res.json();

  await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
  return storageKey as string;
}

export default function NewMoviePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [releaseYear, setReleaseYear] = useState("");
  const [publicDomainNotes, setPublicDomainNotes] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [durationSeconds, setDurationSeconds] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!videoFile) {
      setError("Selecione o arquivo de vídeo do filme");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const finalSlug = slug || slugify(title);
      const videoStorageKey = await uploadFile(videoFile, "movie", finalSlug);
      const posterStorageKey = posterFile ? await uploadFile(posterFile, "poster", finalSlug) : undefined;

      const res = await fetch("/api/admin/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          slug: finalSlug,
          description,
          releaseYear: releaseYear ? Number(releaseYear) : undefined,
          publicDomainNotes,
          videoStorageKey,
          posterStorageKey,
          durationSeconds: Number(durationSeconds),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(JSON.stringify(body.error ?? "Erro ao criar filme"));
      }

      const { movie } = await res.json();
      router.push(`/admin/filmes/${movie.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Novo filme</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <p className="text-red-400 text-sm whitespace-pre-wrap">{error}</p>}

        <input
          required
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-white/10 rounded-md px-4 py-2"
        />
        <input
          placeholder={`slug (padrão: ${slugify(title) || "gerado do título"})`}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="bg-white/10 rounded-md px-4 py-2"
        />
        <textarea
          required
          placeholder="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="bg-white/10 rounded-md px-4 py-2"
          rows={3}
        />
        <input
          type="number"
          placeholder="Ano de lançamento"
          value={releaseYear}
          onChange={(e) => setReleaseYear(e.target.value)}
          className="bg-white/10 rounded-md px-4 py-2"
        />
        <textarea
          required
          placeholder="Notas de domínio público (fonte/jurisdição que comprova que pode ser distribuído livremente)"
          value={publicDomainNotes}
          onChange={(e) => setPublicDomainNotes(e.target.value)}
          className="bg-white/10 rounded-md px-4 py-2"
          rows={3}
        />
        <input
          type="number"
          required
          placeholder="Duração (segundos)"
          value={durationSeconds}
          onChange={(e) => setDurationSeconds(e.target.value)}
          className="bg-white/10 rounded-md px-4 py-2"
        />

        <label className="text-sm text-white/60">
          Arquivo do filme (vídeo)
          <input
            type="file"
            accept="video/*"
            required
            onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
            className="block mt-1"
          />
        </label>

        <label className="text-sm text-white/60">
          Pôster (opcional)
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPosterFile(e.target.files?.[0] ?? null)}
            className="block mt-1"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="bg-brand rounded-md px-4 py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Salvar filme"}
        </button>
      </form>
    </main>
  );
}
