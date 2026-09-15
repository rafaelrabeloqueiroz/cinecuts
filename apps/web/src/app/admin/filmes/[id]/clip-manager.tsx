"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SocialPost = {
  id: string;
  status: string;
  scheduledFor: string;
  externalPostId: string | null;
  errorMessage: string | null;
};

type Clip = {
  id: string;
  title: string;
  caption: string;
  startSeconds: number;
  endSeconds: number;
  status: string;
  errorMessage: string | null;
  socialPosts: SocialPost[];
};

export default function ClipManager({ movieId, movieTitle, clips }: { movieId: string; movieTitle: string; clips: Clip[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState(`Assista "${movieTitle}" completo — link na bio!`);
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("30");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createClip(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/admin/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        movieId,
        title,
        caption,
        startSeconds: Number(start),
        endSeconds: Number(end),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Erro ao criar clipe");
      return;
    }
    setTitle("");
    router.refresh();
  }

  async function regenerate(clipId: string) {
    await fetch(`/api/admin/clips/${clipId}/generate`, { method: "POST" });
    router.refresh();
  }

  async function schedulePost(clipId: string, formData: FormData) {
    const scheduledFor = formData.get("scheduledFor") as string;
    const postCaption = formData.get("caption") as string;
    await fetch("/api/admin/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clipId,
        caption: postCaption,
        scheduledFor: new Date(scheduledFor).toISOString(),
      }),
    });
    router.refresh();
  }

  async function publishNow(postId: string) {
    await fetch(`/api/admin/posts/${postId}/publish-now`, { method: "POST" });
    router.refresh();
  }

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold mb-4">Clipes</h2>

      <form onSubmit={createClip} className="flex flex-wrap gap-3 items-end bg-white/5 p-4 rounded-lg mb-6">
        {error && <p className="text-red-400 text-sm w-full">{error}</p>}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Título do clipe</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-white/10 rounded-md px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Início (s)</label>
          <input
            type="number"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="bg-white/10 rounded-md px-3 py-2 w-24"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-white/50">Fim (s)</label>
          <input
            type="number"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="bg-white/10 rounded-md px-3 py-2 w-24"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-xs text-white/50">Legenda</label>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="bg-white/10 rounded-md px-3 py-2"
          />
        </div>
        <button type="submit" disabled={loading} className="bg-brand rounded-md px-4 py-2 font-semibold">
          {loading ? "Criando..." : "Gerar clipe"}
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {clips.map((clip) => (
          <div key={clip.id} className="bg-white/5 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{clip.title}</p>
                <p className="text-white/50 text-sm">
                  {clip.startSeconds}s–{clip.endSeconds}s · status:{" "}
                  <span className={clip.status === "READY" ? "text-green-400" : clip.status === "FAILED" ? "text-red-400" : "text-yellow-400"}>
                    {clip.status}
                  </span>
                </p>
                {clip.errorMessage && <p className="text-red-400 text-xs mt-1">{clip.errorMessage}</p>}
              </div>
              <button
                onClick={() => regenerate(clip.id)}
                className="border border-white/20 rounded-md px-3 py-1.5 text-sm hover:bg-white/10"
              >
                Regerar
              </button>
            </div>

            {clip.status === "READY" && (
              <form
                action={(formData) => schedulePost(clip.id, formData)}
                className="flex flex-wrap items-end gap-3 mt-4 border-t border-white/10 pt-4"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-white/50">Agendar para</label>
                  <input type="datetime-local" name="scheduledFor" required className="bg-white/10 rounded-md px-3 py-2" />
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-xs text-white/50">Legenda do post</label>
                  <input name="caption" defaultValue={clip.caption} className="bg-white/10 rounded-md px-3 py-2" />
                </div>
                <button type="submit" className="bg-brand rounded-md px-4 py-2 font-semibold text-sm">
                  Agendar no Instagram
                </button>
              </form>
            )}

            {clip.socialPosts.length > 0 && (
              <ul className="mt-3 text-sm text-white/60 space-y-1">
                {clip.socialPosts.map((post) => (
                  <li key={post.id} className="flex items-center justify-between">
                    <span>
                      {new Date(post.scheduledFor).toLocaleString("pt-BR")} — {post.status}
                      {post.errorMessage ? ` (${post.errorMessage})` : ""}
                    </span>
                    {post.status !== "POSTED" && (
                      <button onClick={() => publishNow(post.id)} className="underline text-xs">
                        Publicar agora
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
