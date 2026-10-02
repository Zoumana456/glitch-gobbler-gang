import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Bot, Loader2, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { projectAssistant, type SuggestedMilestone } from "@/lib/project-ai.functions";

type Msg = { role: "user" | "assistant"; content: string; milestones?: SuggestedMilestone[] };

const QUICK = [
  "Fais un diagnostic complet de la santé du projet",
  "Quels sont les risques et jalons en retard ?",
  "Analyse les écarts de budget",
  "Rédige une note d'avancement pour le comité de pilotage",
  "Propose les prochains jalons à planifier",
  "Quelles sont les priorités de la semaine ?",
];

export function ProjectAssistant({
  projectId,
  onAddMilestones,
}: {
  projectId: string;
  onAddMilestones: (m: SuggestedMilestone[]) => Promise<void>;
}) {
  const ask = useServerFn(projectAssistant);
  const key = `project-ai:${projectId}`;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setMsgs(JSON.parse(localStorage.getItem(key) ?? "[]")); } catch { /* ignore */ }
  }, [key]);
  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(msgs.slice(-40)));
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, key]);

  async function send(q: string) {
    const message = q.trim();
    if (!message || busy) return;
    const history = msgs.slice(-12).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: message }]);
    setText("");
    setBusy(true);
    try {
      const r = await ask({ data: { projectId, message, history } });
      setMsgs((m) => [...m, { role: "assistant", content: r.reply, milestones: r.milestones }]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Assistante de pilotage</h2>
          {msgs.length > 0 && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setMsgs([])}>Effacer</Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <Button key={q} variant="outline" size="sm" disabled={busy} onClick={() => send(q)}>{q}</Button>
          ))}
        </div>
        <div className="max-h-[480px] space-y-3 overflow-y-auto">
          {msgs.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Posez une question sur le projet : l'assistante connaît ses jalons, son équipe, son budget et ses documents.
            </p>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">{m.content}</div>
            ) : (
              <div key={i} className="space-y-2 text-sm">
                <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                {m.milestones && m.milestones.length > 0 && (
                  <div className="rounded-md border p-3">
                    <ul className="mb-2 list-disc pl-5">
                      {m.milestones.map((s, j) => (
                        <li key={j}>{s.title}{s.due_date ? ` — ${s.due_date}` : ""}{s.responsible ? ` (${s.responsible})` : ""}</li>
                      ))}
                    </ul>
                    <Button size="sm" onClick={async () => {
                      await onAddMilestones(m.milestones!);
                      setMsgs((all) => all.map((x, k) => (k === i ? { ...x, milestones: [] } : x)));
                      toast.success("Jalons ajoutés au projet");
                    }}><Plus className="mr-1 h-4 w-4" />Ajouter ces jalons</Button>
                  </div>
                )}
              </div>
            ),
          )}
          {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Analyse en cours…</div>}
          <div ref={end} />
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(text); }}>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }}
            placeholder="Ex. : que faut-il faire pour rattraper le retard ?"
            rows={2}
          />
          <Button type="submit" size="icon" disabled={busy || !text.trim()}><Send className="h-4 w-4" /></Button>
        </form>
      </CardContent>
    </Card>
  );
}
