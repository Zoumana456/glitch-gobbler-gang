import { Fragment } from "react";
import {
  budgetTotals,
  formatAmount,
  groupBudgetLines,
  linePlanned,
  lineVariance,
  lineExecutionRate,
} from "@/lib/budget";
import type { LoadedReport } from "@/lib/reports.types";

export function BudgetView({ report }: { report: LoadedReport }) {
  const lines = report.budget_lines ?? [];
  const currency = report.currency ?? "XOF";
  const taxRate = report.tax_rate ?? 0;
  const groups = groupBudgetLines(lines);
  const totals = budgetTotals(lines, taxRate);

  return (
    <div className="space-y-6">
      <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2 text-sm">
        {report.doc_number && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-32">Numéro</dt>
            <dd className="font-medium">{report.doc_number}</dd>
          </div>
        )}
        {report.period_label && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-32">Période</dt>
            <dd>{report.period_label}</dd>
          </div>
        )}
        {report.counterparty && (
          <div className="flex gap-2">
            <dt className="text-muted-foreground w-32">Entité</dt>
            <dd>{report.counterparty}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-32">Devise / TVA</dt>
          <dd>
            {currency} · {taxRate} %
          </dd>
        </div>
      </dl>

      {report.intro && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Contexte
          </h2>
          <p className="whitespace-pre-wrap leading-relaxed">{report.intro}</p>
        </section>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Rubrique</th>
              <th className="px-3 py-2 text-left font-medium w-[70px]">Unité</th>
              <th className="px-3 py-2 text-right font-medium w-[64px]">Qté</th>
              <th className="px-3 py-2 text-right font-medium w-[110px]">P.U.</th>
              <th className="px-3 py-2 text-right font-medium w-[120px]">Prévu</th>
              <th className="px-3 py-2 text-right font-medium w-[120px]">Réalisé</th>
              <th className="px-3 py-2 text-right font-medium w-[120px]">Écart</th>
              <th className="px-3 py-2 text-left font-medium w-[160px]">Observations</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g.category}>
                <tr className="bg-muted/30 border-t border-border">
                  <td colSpan={8} className="px-3 py-1.5 font-semibold text-xs uppercase tracking-wide">
                    {g.category}
                  </td>
                </tr>
                {g.lines.map((l, i) => (
                  <tr key={l.id ?? `${g.category}-${i}`} className="border-t border-border">
                    <td className="px-3 py-2">{l.label || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{l.unit || "—"}</td>
                    <td className="px-3 py-2 text-right">{l.quantity || "—"}</td>
                    <td className="px-3 py-2 text-right">{formatAmount(l.unit_price, currency)}</td>
                    <td className="px-3 py-2 text-right">{formatAmount(linePlanned(l), currency)}</td>
                    <td className="px-3 py-2 text-right">{formatAmount(l.actual_amount, currency)}</td>
                    <td className={`px-3 py-2 text-right ${lineVariance(l) < 0 ? "text-destructive" : ""}`}>
                      {formatAmount(lineVariance(l), currency)}
                      <span className="block text-[11px] text-muted-foreground">
                        {lineExecutionRate(l) === null ? "—" : `${lineExecutionRate(l)}%`}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{l.notes || ""}</td>
                  </tr>
                ))}
                <tr className="border-t border-border bg-muted/10 text-xs">
                  <td colSpan={4} className="px-3 py-1.5 text-right text-muted-foreground">
                    Sous-total {g.category}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium">{formatAmount(g.planned, currency)}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{formatAmount(g.actual, currency)}</td>
                  <td className="px-3 py-1.5 text-right font-medium">{formatAmount(g.variance, currency)}</td>
                  <td />
                </tr>
              </Fragment>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Aucune ligne budgétaire.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-muted/50 border-t-2 border-border">
            <tr className="font-semibold">
              <td colSpan={4} className="px-3 py-2 text-right">Total prévu</td>
              <td className="px-3 py-2 text-right">{formatAmount(totals.planned, currency)}</td>
              <td className="px-3 py-2 text-right">{formatAmount(totals.actual, currency)}</td>
              <td className={`px-3 py-2 text-right ${totals.variance < 0 ? "text-destructive" : ""}`}>
                {formatAmount(totals.variance, currency)}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {totals.executionRate === null ? "" : `${totals.executionRate}% exécuté`}
              </td>
            </tr>
            {taxRate > 0 && (
              <>
                <tr>
                  <td colSpan={4} className="px-3 py-1.5 text-right text-muted-foreground">TVA {taxRate}%</td>
                  <td className="px-3 py-1.5 text-right">{formatAmount(totals.taxAmount, currency)}</td>
                  <td colSpan={3} />
                </tr>
                <tr className="font-bold">
                  <td colSpan={4} className="px-3 py-1.5 text-right">Total TTC</td>
                  <td className="px-3 py-1.5 text-right">{formatAmount(totals.totalWithTax, currency)}</td>
                  <td colSpan={3} />
                </tr>
              </>
            )}
          </tfoot>
        </table>
      </div>

      {report.conclusion && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Commentaires
          </h2>
          <p className="whitespace-pre-wrap leading-relaxed">{report.conclusion}</p>
        </section>
      )}
    </div>
  );
}
