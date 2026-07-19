import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLog } from "@/lib/admin.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Search } from "lucide-react";
import { formatLongDate } from "@/lib/date-utils";

export function AuditPanel() {
  const listFn = useServerFn(listAuditLog);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-audit", debouncedQ],
    queryFn: () => listFn({ data: { q: debouncedQ } }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" /> Journal d'audit ({rows.length})
          </CardTitle>
          <div className="relative w-72">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Chercher acteur ou entité…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") setDebouncedQ(q); }}
              onBlur={() => setDebouncedQ(q)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Chargement…</div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune action enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="rounded border p-2.5 text-sm">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">{r.action}</Badge>
                    <span className="text-muted-foreground text-xs">{r.actor_email ?? "système"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatLongDate(r.created_at)}</span>
                </div>
                {r.entity_type && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.entity_type} · {r.entity_id}
                  </div>
                )}
                {r.metadata && Object.keys(r.metadata).length > 0 && (
                  <pre className="text-[11px] font-mono bg-muted/50 rounded p-1.5 mt-1 max-h-24 overflow-auto">
                    {JSON.stringify(r.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
