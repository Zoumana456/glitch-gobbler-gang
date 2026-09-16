import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, Plus, Trash2, Send, Paperclip, ShieldCheck } from "lucide-react";
import {
  listMyExpenses,
  deleteExpense,
  submitExpense,
  getReceiptUrl,
} from "@/lib/expenses/expenses.functions";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  formatAmount,
  normalizeStatus,
} from "@/lib/expenses/expenses.server";

export const Route = createFileRoute("/_authenticated/expenses/")({
  head: () => ({
    meta: [
      { title: "Notes de frais — DailyBrief" },
      {
        name: "description",
        content:
          "Déclarez vos dépenses professionnelles avec justificatif et suivez leur validation.",
      },
      { property: "og:title", content: "Notes de frais — DailyBrief" },
      {
        property: "og:description",
        content: "Saisie, justificatif photo et validation par votre responsable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExpensesPage,
});

function statusTone(status: string): string {
  const s = normalizeStatus(status);
  if (s === "approved") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (s === "rejected") return "bg-destructive/10 text-destructive";
  if (s === "draft") return "bg-muted text-muted-foreground";
  return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
}

function ExpensesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyExpenses);
  const deleteFn = useServerFn(deleteExpense);
  const submitFn = useServerFn(submitExpense);
  const receiptFn = useServerFn(getReceiptUrl);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["expenses", "mine"],
    queryFn: () => listFn(),
  });

  const total = useMemo(
    () =>
      rows
        .filter((r) => normalizeStatus(r.status) === "approved")
        .reduce((s, r) => s + r.amount, 0),
    [rows],
  );

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Note de frais supprimée.");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const send = useMutation({
    mutationFn: (id: string) => submitFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Envoyée pour validation.");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  async function openReceipt(id: string) {
    try {
      const { url } = await receiptFn({ data: { id } });
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e?.message ?? "Justificatif indisponible");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Receipt className="h-6 w-6 text-primary" />
            Mes notes de frais
          </h1>
          <p className="text-sm text-muted-foreground">
            Total approuvé : {new Intl.NumberFormat("fr-FR").format(total)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/expenses/validations">
              <ShieldCheck className="mr-2 h-4 w-4" />À valider
            </Link>
          </Button>
          <Button asChild>
            <Link to="/expenses/new">
              <Plus className="mr-2 h-4 w-4" />
              Nouvelle note
            </Link>
          </Button>
        </div>
      </header>

      {isLoading ? (
        <Card>
          <CardContent className="p-6">
            <div className="h-24 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Aucune note de frais pour l'instant.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const s = normalizeStatus(r.status);
            return (
              <Card key={r.id}>
                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.expense_date).toLocaleDateString("fr-FR")}
                      {r.category
                        ? ` · ${EXPENSE_CATEGORY_LABELS[r.category] ?? r.category}`
                        : ""}
                    </p>
                    {r.decision_comment && (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        « {r.decision_comment} »
                      </p>
                    )}
                  </div>
                  <span className="font-semibold">
                    {formatAmount(r.amount, r.currency)}
                  </span>
                  <Badge className={statusTone(r.status)} variant="secondary">
                    {EXPENSE_STATUS_LABELS[r.status] ?? s}
                  </Badge>
                  {r.receipt_url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Voir le justificatif"
                      onClick={() => openReceipt(r.id)}
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  )}
                  {s === "draft" && (
                    <Button size="sm" onClick={() => send.mutate(r.id)}>
                      <Send className="mr-2 h-4 w-4" />
                      Envoyer
                    </Button>
                  )}
                  {(s === "draft" || s === "submitted") && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Supprimer ${r.title}`}
                      onClick={() => remove.mutate(r.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
