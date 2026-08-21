import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyModules, setModuleEnabled } from "@/lib/modules.functions";
import { APP_MODULES } from "@/lib/modules/registry";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutGrid, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/company/applications")({
  head: () => ({
    meta: [
      { title: "Applications de l'entreprise — DailyBrief" },
      {
        name: "description",
        content:
          "Activez ou désactivez les applications DailyBrief utilisées par votre entreprise.",
      },
    ],
  }),
  component: CompanyApplicationsPage,
});

function CompanyApplicationsPage() {
  const qc = useQueryClient();
  const modulesFn = useServerFn(getMyModules);
  const setFn = useServerFn(setModuleEnabled);

  const { data: state, isLoading } = useQuery({
    queryKey: ["my-modules"],
    queryFn: () => modulesFn(),
  });

  const mut = useMutation({
    mutationFn: (v: { code: string; enabled: boolean }) => setFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: ["my-modules"] });
      const prev = qc.getQueryData<any>(["my-modules"]);
      qc.setQueryData<any>(["my-modules"], (old: any) => {
        if (!old) return old;
        const set = new Set<string>(old.disabled ?? []);
        if (v.enabled) set.delete(v.code);
        else set.add(v.code);
        return { ...old, disabled: [...set] };
      });
      return { prev };
    },
    onSuccess: () => {
      toast.success("Applications mises à jour");
    },
    onError: (e: any, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(["my-modules"], ctx.prev);
      toast.error(
        e?.message ??
          "Impossible d'enregistrer ce réglage. Vérifiez que vous êtes propriétaire de l'entreprise.",
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["my-modules"] });
    },
  });

  const disabled = new Set(state?.disabled ?? []);
  const isOwner = state?.isOwner ?? false;

  return (
    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-6">
      <header className="grid grid-cols-1 gap-4 sm:flex sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold flex min-w-0 items-center gap-2">
            <LayoutGrid className="h-6 w-6 shrink-0 text-primary" />
            <span className="truncate">Applications</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Choisissez les applications visibles par votre équipe.
          </p>
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/apps">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Lanceur
          </Link>
        </Button>
      </header>

      {!isOwner && !isLoading && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Seul le propriétaire de l'entreprise peut modifier ces réglages.
        </p>
      )}

      <div className="space-y-3">
        {APP_MODULES.map((m) => {
          const Icon = m.icon;
          const enabled = m.core || !disabled.has(m.code);
          return (
            <Card key={m.code}>
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${m.tone}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{m.name}</span>
                    {m.core && <Badge variant="secondary">Toujours active</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                </div>
                <Switch
                  checked={enabled}
                  disabled={m.core || !isOwner || mut.isPending}
                  onCheckedChange={(v) => mut.mutate({ code: m.code, enabled: v })}
                  aria-label={`Activer ${m.name}`}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
