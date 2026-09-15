"use client";

import { useRouter } from "next/navigation";

export default function PublishToggle({ movieId, status }: { movieId: string; status: string }) {
  const router = useRouter();

  async function setStatus(newStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    await fetch(`/api/admin/movies/${movieId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      {status !== "PUBLISHED" && (
        <button onClick={() => setStatus("PUBLISHED")} className="bg-brand px-4 py-2 rounded-md text-sm font-semibold">
          Publicar no catálogo
        </button>
      )}
      {status === "PUBLISHED" && (
        <button onClick={() => setStatus("DRAFT")} className="border border-white/20 px-4 py-2 rounded-md text-sm">
          Despublicar
        </button>
      )}
    </div>
  );
}
