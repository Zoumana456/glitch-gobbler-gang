import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { globalAssistant } from "@/lib/global-ai.functions";

type Msg = { role: "user" | "assistant"; content: string };
const KEY = "global-ai:conversation";
const QUICK = [
  "Quels projets sont en retard ou à risque ?",
  "Résume mes notes de frais en attente",
  "Quels documents ai-je dans la GED ?",
  "Fais un point global de la semaine",
];

export function GlobalAssistant({ collapsed }: { collapsed?: boolean }) {
  const ask = useServerFn(globalAssistant);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { try { setMsgs(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { /* ignore */ } }, []);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(msgs.slice(-40)));
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs]);

  async function send(q: string) {
    const message = q.trim();
    if (!message || busy) return;
    const history = msgs.slice(-12);
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setText("");
    setBusy(true);
    try {
      const r = await ask({ data: { message, history } });
      setMsgs((m) => [...m, { role: "assistant", content: r.reply }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size={collapsed ? "icon" : "sm"} aria-label="Assistante IA" title="Assistante IA" className={collapsed ? "" : "w-full justify-start"}>
          <Bot className="h-4 w-4" />{!collapsed && <span className="ml-2">Assistante IA</span>}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2"><Bot className="h-5 w-5 text-primary" />Assistante DailyBrief</SheetTitle>
          <p className="text-xs text-muted-foreground">Interrogez vos projets, documents et notes de frais.</p>
        </SheetHeader>
        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <div className="grid gap-2">
              {QUICK.map((q) => <Button key={q} variant="outline" size="sm" className="h-auto justify-start whitespace-normal text-left" onClick={() => send(q)}>{q}</Button>)}
            </div>
          )}
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground" : "prose prose-sm max-w-none dark:prose-invert"}>
              {m.role === "user" ? m.content : <ReactMarkdown>{m.content}</ReactMarkdown>}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analyse en cours…</div>}
          <div ref={end} />
        </div>
        <div className="border-t p-3">
          <div className="flex gap-2">
            <Textarea autoFocus rows={2} value={text} placeholder="Posez votre question…" onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} />
            <Button size="icon" onClick={() => send(text)} disabled={busy || !text.trim()}><Send className="h-4 w-4" /></Button>
          </div>
          {msgs.length > 0 && <button className="mt-1 text-xs text-muted-foreground underline" onClick={() => setMsgs([])}>Effacer la conversation</button>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
