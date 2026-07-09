import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Props = {
  onTranscript: (text: string) => void;
  label?: string;
};

function floatsToWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (outRate >= inRate) return input;
  const ratio = inRate / outRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const idx = Math.floor(i * ratio);
    out[i] = input[idx];
  }
  return out;
}

export function DictationButton({ onTranscript, label = "Dicter" }: Props) {
  const [state, setState] = useState<"idle" | "recording" | "processing">("idle");
  const [elapsed, setElapsed] = useState(0);
  const chunksRef = useRef<Float32Array[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (nodeRef.current) nodeRef.current.disconnect();
    if (sourceRef.current) sourceRef.current.disconnect();
    if (ctxRef.current && ctxRef.current.state !== "closed") ctxRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    chunksRef.current = [];
    nodeRef.current = null;
    sourceRef.current = null;
    ctxRef.current = null;
    streamRef.current = null;
  }

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      chunksRef.current = [];
      node.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      node.connect(ctx.destination);
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      toast.error("Impossible d'accéder au micro. Vérifiez les autorisations.");
    }
  }

  async function stop() {
    if (state !== "recording") return;
    setState("processing");
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    const ctx = ctxRef.current!;
    const totalLen = chunksRef.current.reduce((a, c) => a + c.length, 0);
    const merged = new Float32Array(totalLen);
    let off = 0;
    for (const c of chunksRef.current) {
      merged.set(c, off);
      off += c.length;
    }
    const inRate = ctx.sampleRate;
    const down = downsample(merged, inRate, 16000);
    const wav = floatsToWav(down, 16000);
    cleanup();

    if (wav.size < 2048) {
      toast.error("Enregistrement trop court. Réessayez.");
      setState("idle");
      return;
    }

    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Session expirée. Reconnectez-vous.");
      const form = new FormData();
      form.append("file", wav, "recording.wav");
      const res = await fetch("/api/public/ai/transcribe", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Transcription impossible");
      const text = (json?.text ?? "").trim();
      if (!text) {
        toast.info("Aucun texte reconnu.");
      } else {
        onTranscript(text);
        toast.success("Transcription ajoutée");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Transcription impossible");
    } finally {
      setState("idle");
    }
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <Button
      type="button"
      variant={state === "recording" ? "destructive" : "outline"}
      size="sm"
      onClick={state === "recording" ? stop : state === "idle" ? start : undefined}
      disabled={state === "processing"}
      className={cn(state === "recording" && "animate-pulse")}
    >
      {state === "recording" ? (
        <>
          <Square className="h-4 w-4 mr-1.5 fill-current" />
          {mm}:{ss} — Arrêter
        </>
      ) : state === "processing" ? (
        <>
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          Transcription…
        </>
      ) : (
        <>
          <Mic className="h-4 w-4 mr-1.5" />
          {label}
        </>
      )}
    </Button>
  );
}
