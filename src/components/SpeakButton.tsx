import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  autoPlayKey?: number | string | null;
  onEnded?: () => void;
  size?: "sm" | "icon";
  className?: string;
};

export function SpeakButton({
  text,
  autoPlayKey,
  onEnded,
  size = "icon",
  className,
}: Props) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);
  const lastKeyRef = useRef<Props["autoPlayKey"]>(null);

  function cleanup() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }

  useEffect(() => () => cleanup(), []);

  async function play() {
    if (state !== "idle") {
      // Toggle stop
      cleanup();
      setState("idle");
      return;
    }
    if (!text.trim()) return;
    setState("loading");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Session expirée. Reconnectez-vous.");

      const res = await fetch("/api/public/ai/speak", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
        signal: ac.signal,
      });
      if (!res.ok) {
        let msg = `Synthèse vocale impossible (${res.status})`;
        try {
          const j = await res.json();
          if (j?.error) msg = j.error;
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      if (ac.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        cleanup();
        setState("idle");
        onEnded?.();
      };
      audio.onerror = () => {
        cleanup();
        setState("idle");
        toast.error("Lecture audio impossible");
      };
      await audio.play();
      setState("playing");
    } catch (err: any) {
      cleanup();
      setState("idle");
      if (err?.name !== "AbortError") {
        toast.error(err?.message ?? "Synthèse vocale impossible");
      }
    }
  }

  // Autoplay when the trigger key changes.
  useEffect(() => {
    if (autoPlayKey == null) return;
    if (lastKeyRef.current === autoPlayKey) return;
    lastKeyRef.current = autoPlayKey;
    void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlayKey]);

  return (
    <Button
      type="button"
      size={size}
      variant="ghost"
      onClick={play}
      disabled={state === "loading"}
      title={
        state === "playing"
          ? "Arrêter la lecture"
          : state === "loading"
            ? "Chargement…"
            : "Écouter"
      }
      className={cn("h-7 w-7", className)}
    >
      {state === "loading" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "playing" ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}
