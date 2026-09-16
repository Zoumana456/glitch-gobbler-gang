import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ShieldCheck, Check, X, Paperclip } from "lucide-react";
import {
  listExpensesToApprove,
  decideExpense,
  getReceiptUrl,
} from "@/lib/expenses/expenses.functions";
import {
  EXPENSE_CATEGORY_LABELS,
  formatAmount,
} from "@/lib/expenses/expenses.server";

export const Route = createFileRoute("/_authenticated/expenses/validations")({
  head: () => ({
    meta: [
      { title: "Notes de frais à valider — DailyBrief" },
      {
        name: "description",
        content:
          "Approuvez ou refusez les notes de frais de votre équipe, avec commentaire.",
      },
      { property: "og:title", content: "Notes de frais à valider — DailyBrief" },
      {
        property: "og:description",
        content: "File d'attente de validation des dépenses de votre équipe.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ExpenseValidationsPage,
});

function ExpenseValidationsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listExpensesToApprove);
  const decideFn = useServerFn(decideExpense);
  const receiptFn = useServerFn(getReceiptUrl);
  const [comments, setComments] = useState<Record<string, string>>({});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["expenses", "to-approve"],
    queryFn: () => listFn(),
  });

  const decide = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) =>
      decideFn({
        data: { id: v.id, approve: v.approve, comment: comments[v.id] || undefined },
      }),
    onSuccess: (_d, v) => {
      toast.success(v.approve ? "Note approuvée." : "Note refusée.");
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
      <Button asChild variant="ghost" size="sm" className="px-0">
        <Link to="/expenses">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux notes de frais
        </Link>
      </Button>

      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <ShieldCheck className="h-6 w-6 text-primary" />
          Notes de frais à valider
        </h1>
        <p className="text-sm text-muted-foreground">
          Seules les dépenses des employés dont vous êtes responsable apparaissent ici.
        </p>
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
            Rien à valider pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.author_name ?? "—"} ·{" "}
                      {new Date(r.expense_date).toLocaleDateString("fr-FR")}
                      {r.category
                        ? ` · ${EXPENSE_CATEGORY_LABELS[r.category] ?? r.category}`
                        : ""}
                    </p>
                  </div>
                  <span className="font-semibold">
                    {formatAmount(r.amount, r.currency)}
                  </span>
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
                </div>
                {r.description && <p className="text-sm">{r.description}</p>}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    placeholder="Commentaire (facultatif)"
                    value={comments[r.id] ?? ""}
                    onChange={(e) =>
                      setComments((c) => ({ ...c, [r.id]: e.target.value }))
                    }
                  />
                  <Button
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, approve: true })}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approuver
                  </Button>
                  <Button
                    variant="outline"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate({ id: r.id, approve: false })}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Refuser
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
