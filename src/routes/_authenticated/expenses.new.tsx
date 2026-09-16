import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Receipt, Loader2 } from "lucide-react";
import { createExpense } from "@/lib/expenses/expenses.functions";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
} from "@/lib/expenses/expenses.server";

export const Route = createFileRoute("/_authenticated/expenses/new")({
  head: () => ({
    meta: [
      { title: "Nouvelle note de frais — DailyBrief" },
      {
        name: "description",
        content:
          "Déclarez une dépense professionnelle avec son justificatif et envoyez-la en validation.",
      },
      { property: "og:title", content: "Nouvelle note de frais — DailyBrief" },
      {
        property: "og:description",
        content: "Montant, catégorie, justificatif : tout en une minute.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NewExpensePage,
});

const MAX_SIZE = 10 * 1024 * 1024;

function NewExpensePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createExpense);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState("transport");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadReceipt(): Promise<string | null> {
    if (!file) return null;
    if (file.size > MAX_SIZE) throw new Error("Justificatif trop volumineux (10 Mo max).");
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Session expirée.");
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from("expense-receipts")
        .upload(path, file, { upsert: false });
      if (error) throw new Error(error.message);
      return path;
    } finally {
      setUploading(false);
    }
  }

  const create = useMutation({
    mutationFn: async (submit: boolean) => {
      const receiptPath = await uploadReceipt();
      return createFn({
        data: {
          title: title.trim(),
          amount: Number(amount),
          currency,
          expenseDate,
          category,
          description: description.trim() || undefined,
          receiptPath,
          submit,
        },
      });
    },
    onSuccess: () => {
      toast.success("Note de frais enregistrée.");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      navigate({ to: "/expenses" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  const busy = create.isPending || uploading;
  const ready = title.trim().length >= 2 && Number(amount) > 0 && !!expenseDate;

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6 md:p-10">
      <Button asChild variant="ghost" size="sm" className="px-0">
        <Link to="/expenses">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour aux notes de frais
        </Link>
      </Button>

      <header>
        <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
          <Receipt className="h-6 w-6 text-primary" />
          Nouvelle note de frais
        </h1>
        <p className="text-sm text-muted-foreground">
          Votre responsable direct recevra la demande de remboursement.
        </p>
      </header>

      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="exp-title">Objet</Label>
            <Input
              id="exp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Taxi client Plateau"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="exp-amount">Montant</Label>
              <Input
                id="exp-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exp-currency">Devise</Label>
              <Input
                id="exp-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="exp-date">Date de la dépense</Label>
              <Input
                id="exp-date"
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Catégorie">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {EXPENSE_CATEGORY_LABELS[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exp-desc">Détails (facultatif)</Label>
            <Textarea
              id="exp-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="exp-receipt">Justificatif (photo ou PDF, 10 Mo max)</Label>
            <Input
              id="exp-receipt"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Visible uniquement par vous, votre responsable et la direction.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="flex-1"
              disabled={!ready || busy}
              onClick={() => create.mutate(true)}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer pour validation
            </Button>
            <Button
              variant="outline"
              disabled={!ready || busy}
              onClick={() => create.mutate(false)}
            >
              Enregistrer en brouillon
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
