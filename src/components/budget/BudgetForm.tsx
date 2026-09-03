import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { upsertReport } from "@/lib/reports.functions";
import { CURRENCIES, TAX_RATE_PRESETS, DOC_TYPE_LABEL } from "@/lib/budget";
import type { LoadedReport } from "@/lib/reports.types";
import { BudgetLinesTable, emptyLine, type EditableLine } from "./BudgetLinesTable";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function BudgetForm({ initial }: { initial?: LoadedReport }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const save = useServerFn(upsertReport);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [reportDate, setReportDate] = useState(initial?.report_date ?? todayIso());
  const [periodLabel, setPeriodLabel] = useState(initial?.period_label ?? "");
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "XOF");
  const [taxRate, setTaxRate] = useState<number>(initial?.tax_rate ?? 0);
  const [intro, setIntro] = useState(initial?.intro ?? "");
  const [conclusion, setConclusion] = useState(initial?.conclusion ?? "");
  const [lines, setLines] = useState<EditableLine[]>(() => {
    const existing = initial?.budget_lines ?? [];
    if (existing.length > 0) {
      return existing.map((l, i) => ({ ...l, key: `e${l.id ?? i}` }));
    }
    return [emptyLine("l0", 0)];
  });

  const docNumber = initial?.doc_number ?? "";

  const mutation = useMutation({
    mutationFn: async () =>
      save({
        data: {
          id: initial?.id ?? null,
          report_date: reportDate,
          title: title.trim(),
          intro,
          conclusion,
          sections: [],
          images: [],
          attachments: [],
          doc_type: "budget",
          doc_number: docNumber,
          currency,
          tax_rate: taxRate,
          period_label: periodLabel,
          counterparty,
          budget_lines: lines.map((l, i) => ({
            category: l.category,
            label: l.label,
            unit: l.unit,
            quantity: l.quantity,
            unit_price: l.unit_price,
            planned_amount: l.planned_amount,
            actual_amount: l.actual_amount,
            notes: l.notes,
            position: i,
          })),
        },
      }),
    onSuccess: (res: { id: string }) => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      queryClient.invalidateQueries({ queryKey: ["report", res.id] });
      toast.success("Fiche de budget enregistrée");
      navigate({ to: "/reports/$id", params: { id: res.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Enregistrement impossible"),
  });

  const canSave = useMemo(() => title.trim().length > 0 && !mutation.isPending, [title, mutation.isPending]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {DOC_TYPE_LABEL.budget}
            {docNumber ? ` · ${docNumber}` : ""}
          </p>
          <h1 className="text-2xl font-semibold">
            {initial ? "Modifier la fiche de budget" : "Nouvelle fiche de budget"}
          </h1>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={!canSave}>
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Enregistrer
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="budget-title">Intitulé du budget *</Label>
            <Input
              id="budget-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Budget de fonctionnement — Direction technique"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-date">Date</Label>
            <Input
              id="budget-date"
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-period">Période couverte</Label>
            <Input
              id="budget-period"
              value={periodLabel}
              onChange={(e) => setPeriodLabel(e.target.value)}
              placeholder="Exercice 2026 / T1 2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-counterparty">Entité / bénéficiaire</Label>
            <Input
              id="budget-counterparty"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Service, département ou client"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Devise</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>TVA</Label>
              <Select value={String(taxRate)} onValueChange={(v) => setTaxRate(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_RATE_PRESETS.map((r) => (
                    <SelectItem key={r} value={String(r)}>
                      {r} %
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détail budgétaire</CardTitle>
        </CardHeader>
        <CardContent>
          <BudgetLinesTable lines={lines} currency={currency} taxRate={taxRate} onChange={setLines} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="budget-intro">Contexte / hypothèses</Label>
            <Textarea
              id="budget-intro"
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={5}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget-conclusion">Commentaires / recommandations</Label>
            <Textarea
              id="budget-conclusion"
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
              rows={5}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
