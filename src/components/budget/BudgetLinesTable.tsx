import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Copy, ArrowUp, ArrowDown } from "lucide-react";
import {
  formatAmount,
  linePlanned,
  lineVariance,
  lineExecutionRate,
  budgetTotals,
  type BudgetLine,
} from "@/lib/budget";

export type EditableLine = BudgetLine & { key: string };

export function emptyLine(key: string, position: number, category = ""): EditableLine {
  return {
    key,
    category,
    label: "",
    unit: "",
    quantity: 1,
    unit_price: 0,
    planned_amount: 0,
    actual_amount: 0,
    notes: "",
    position,
  };
}

type Props = {
  lines: EditableLine[];
  currency: string;
  taxRate: number;
  onChange: (lines: EditableLine[]) => void;
};

export function BudgetLinesTable({ lines, currency, taxRate, onChange }: Props) {
  const totals = budgetTotals(lines, taxRate);

  const update = (key: string, patch: Partial<EditableLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= lines.length) return;
    const next = [...lines];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((l, i) => ({ ...l, position: i })));
  };

  const remove = (key: string) =>
    onChange(lines.filter((l) => l.key !== key).map((l, i) => ({ ...l, position: i })));

  const duplicate = (index: number) => {
    const src = lines[index];
    const next = [...lines];
    next.splice(index + 1, 0, { ...src, key: `d${Date.now()}${index}`, id: undefined });
    onChange(next.map((l, i) => ({ ...l, position: i })));
  };

  const add = () =>
    onChange([
      ...lines,
      emptyLine(`n${Date.now()}`, lines.length, lines[lines.length - 1]?.category ?? ""),
    ]);

  const num = (v: string) => {
    const n = Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left font-medium w-[140px]">Catégorie</th>
              <th className="px-2 py-2 text-left font-medium">Rubrique</th>
              <th className="px-2 py-2 text-left font-medium w-[80px]">Unité</th>
              <th className="px-2 py-2 text-right font-medium w-[72px]">Qté</th>
              <th className="px-2 py-2 text-right font-medium w-[110px]">P. unitaire</th>
              <th className="px-2 py-2 text-right font-medium w-[120px]">Prévu</th>
              <th className="px-2 py-2 text-right font-medium w-[110px]">Réalisé</th>
              <th className="px-2 py-2 text-right font-medium w-[120px]">Écart</th>
              <th className="px-2 py-2 text-left font-medium w-[150px]">Observations</th>
              <th className="px-2 py-2 w-[104px]" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const planned = linePlanned(l);
              const variance = lineVariance(l);
              const rate = lineExecutionRate(l);
              return (
                <tr key={l.key} className="border-t border-border even:bg-muted/20 align-top">
                  <td className="px-1.5 py-1.5">
                    <Input
                      value={l.category}
                      onChange={(e) => update(l.key, { category: e.target.value })}
                      placeholder="Fonctionnement"
                      className="h-9"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      value={l.label}
                      onChange={(e) => update(l.key, { label: e.target.value })}
                      placeholder="Désignation de la dépense"
                      className="h-9"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      value={l.unit}
                      onChange={(e) => update(l.key, { unit: e.target.value })}
                      placeholder="u."
                      className="h-9"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      inputMode="decimal"
                      value={String(l.quantity)}
                      onChange={(e) => update(l.key, { quantity: num(e.target.value) })}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      inputMode="decimal"
                      value={String(l.unit_price)}
                      onChange={(e) => update(l.key, { unit_price: num(e.target.value) })}
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      inputMode="decimal"
                      value={l.planned_amount ? String(l.planned_amount) : ""}
                      onChange={(e) => update(l.key, { planned_amount: num(e.target.value) })}
                      placeholder={String(planned)}
                      className="h-9 text-right"
                    />
                    <div className="text-[11px] text-muted-foreground text-right mt-0.5">
                      {formatAmount(planned, currency)}
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      inputMode="decimal"
                      value={l.actual_amount ? String(l.actual_amount) : ""}
                      onChange={(e) => update(l.key, { actual_amount: num(e.target.value) })}
                      placeholder="0"
                      className="h-9 text-right"
                    />
                  </td>
                  <td className="px-1.5 py-1.5 text-right">
                    <div className={variance < 0 ? "text-destructive font-medium" : "font-medium"}>
                      {formatAmount(variance, currency)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {rate === null ? "—" : `${rate}% exécuté`}
                    </div>
                  </td>
                  <td className="px-1.5 py-1.5">
                    <Input
                      value={l.notes}
                      onChange={(e) => update(l.key, { notes: e.target.value })}
                      className="h-9"
                    />
                  </td>
                  <td className="px-1.5 py-1.5">
                    <div className="flex items-center gap-0.5">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, -1)} aria-label="Monter">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(i, 1)} aria-label="Descendre">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicate(i)} aria-label="Dupliquer la ligne">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => remove(l.key)}
                        aria-label="Supprimer la ligne"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {lines.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                  Aucune ligne. Ajoutez une première rubrique budgétaire.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-muted/50 border-t-2 border-border">
            <tr className="font-medium">
              <td colSpan={5} className="px-2 py-2 text-right">Total prévu</td>
              <td className="px-2 py-2 text-right">{formatAmount(totals.planned, currency)}</td>
              <td className="px-2 py-2 text-right">{formatAmount(totals.actual, currency)}</td>
              <td className={`px-2 py-2 text-right ${totals.variance < 0 ? "text-destructive" : ""}`}>
                {formatAmount(totals.variance, currency)}
              </td>
              <td colSpan={2} className="px-2 py-2 text-muted-foreground text-xs">
                {totals.executionRate === null ? "" : `${totals.executionRate}% d'exécution`}
              </td>
            </tr>
            {taxRate > 0 && (
              <>
                <tr>
                  <td colSpan={5} className="px-2 py-1.5 text-right text-muted-foreground">TVA {taxRate}%</td>
                  <td className="px-2 py-1.5 text-right">{formatAmount(totals.taxAmount, currency)}</td>
                  <td colSpan={4} />
                </tr>
                <tr className="font-semibold">
                  <td colSpan={5} className="px-2 py-1.5 text-right">Total TTC</td>
                  <td className="px-2 py-1.5 text-right">{formatAmount(totals.totalWithTax, currency)}</td>
                  <td colSpan={4} />
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>
      <Button type="button" variant="outline" onClick={add}>
        <Plus className="h-4 w-4 mr-2" />
        Ajouter une ligne
      </Button>
    </div>
  );
}
