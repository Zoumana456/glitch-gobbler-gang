import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  createCompany,
  joinCompanyDirect,
  listCompaniesDirectory,
} from "@/lib/company.functions";
import { checkNameReservedPublic } from "@/lib/reserved-names.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, FileText, Building2, User, Users, Check, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Connexion — Lovable Rapports" },
      { name: "description", content: "Connectez-vous à votre espace rapports d'équipe." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});


type AccountKind = "particulier" | "employee" | "dg";

const ACCOUNT_KINDS: {
  id: AccountKind;
  title: string;
  desc: string;
  icon: typeof User;
  accent: string;
}[] = [
  {
    id: "particulier",
    title: "Particulier",
    desc: "Rapports personnels, usage individuel.",
    icon: User,
    accent: "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400",
  },
  {
    id: "employee",
    title: "Employé",
    desc: "Rejoindre une entreprise déjà existante.",
    icon: Users,
    accent: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "dg",
    title: "DG / Entreprise",
    desc: "Créer un espace équipe et inviter vos collaborateurs.",
    icon: Building2,
    accent: "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400",
  },
];

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const createCompanyFn = useServerFn(createCompany);
  const joinCompanyFn = useServerFn(joinCompanyDirect);
  const listCompaniesFn = useServerFn(listCompaniesDirectory);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [accountKind, setAccountKind] = useState<AccountKind>("particulier");
  const [companyName, setCompanyName] = useState("");
  const [joinCompanyId, setJoinCompanyId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const { data: companies } = useQuery({
    queryKey: ["companies-directory"],
    queryFn: () => listCompaniesFn(),
    enabled: mode === "signup" && accountKind === "employee",
    staleTime: 60_000,
  });

  const checkReservedFn = useServerFn(checkNameReservedPublic);
  const [reservedInfo, setReservedInfo] = useState<{ reserved: boolean; displayName: string | null }>(
    { reserved: false, displayName: null },
  );

  useEffect(() => {
    if (accountKind !== "dg" || !companyName.trim()) {
      setReservedInfo({ reserved: false, displayName: null });
      return;
    }
    const name = companyName.trim();
    const t = setTimeout(() => {
      checkReservedFn({ data: { name } })
        .then((r) => setReservedInfo(r))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [companyName, accountKind, checkReservedFn]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect ?? "/reports", replace: true });
    });
  }, [navigate, redirect]);


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (accountKind === "dg" && !companyName.trim()) {
          throw new Error("Nom de l'entreprise requis");
        }
        if (accountKind === "dg" && reservedInfo.reserved) {
          throw new Error(
            `« ${reservedInfo.displayName} » est un nom protégé. Créez votre compte, puis soumettez une demande de vérification depuis « Mon entreprise ».`,
          );
        }

        if (accountKind === "employee" && !joinCompanyId) {
          throw new Error("Choisissez votre entreprise dans la liste");
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (data.session) {
          if (accountKind === "dg") {
            try {
              await createCompanyFn({ data: { name: companyName.trim() } });
              toast.success(`Bienvenue chez ${companyName.trim()}`);
            } catch (err: any) {
              toast.error(err?.message ?? "Compte créé mais entreprise non créée");
            }
            navigate({ to: "/company", replace: true });
            return;
          }
          if (accountKind === "employee") {
            try {
              const res = await joinCompanyFn({ data: { companyId: joinCompanyId } });
              toast.success(`Compte relié à ${res.companyName}`);
            } catch (err: any) {
              toast.error(err?.message ?? "Compte créé mais rattachement échoué");
            }
            navigate({ to: "/company", replace: true });
            return;
          }
          toast.success("Compte créé, vous êtes connecté.");
          navigate({ to: redirect ?? "/reports", replace: true });
        } else {
          toast.success("Compte créé. Vous pouvez vous connecter.");
          setMode("signin");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connecté");
        navigate({ to: redirect ?? "/reports", replace: true });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email de réinitialisation envoyé.");
        setMode("signin");
      }
    } catch (err: any) {
      const raw = String(err?.message ?? "");
      let msg = raw || "Une erreur est survenue";
      if (/weak|pwned|known to be|leaked/i.test(raw)) {
        msg = "Ce mot de passe apparaît dans une fuite connue. Choisissez-en un unique (essayez une phrase de passe ou un mot de passe généré).";
      } else if (/at least|should be|minimum|characters/i.test(raw)) {
        msg = "Mot de passe trop court. Utilisez au moins 8 caractères.";
      } else if (/invalid login|invalid credentials/i.test(raw)) {
        msg = "Email ou mot de passe incorrect.";
      } else if (/already registered|already exists/i.test(raw)) {
        msg = "Un compte existe déjà avec cet email.";
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 text-primary">
          <FileText className="h-6 w-6" />
          <span className="text-xl font-semibold text-foreground">Lovable Rapports</span>
        </Link>
        <Card className="shadow-sm border-border/80">
          <CardHeader>
            <CardTitle className="text-center text-xl">
              {mode === "signin" && "Connexion"}
              {mode === "signup" && "Créer un compte"}
              {mode === "forgot" && "Mot de passe oublié"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  <div className="space-y-2">
                    <Label>Type de compte</Label>
                    <div className="space-y-2">
                      {ACCOUNT_KINDS.map((k) => {
                        const Icon = k.icon;
                        const selected = accountKind === k.id;
                        return (
                          <button
                            key={k.id}
                            type="button"
                            onClick={() => setAccountKind(k.id)}
                            className={cn(
                              "group relative w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                              selected
                                ? "border-primary bg-primary/[0.04] shadow-sm"
                                : "border-border hover:border-primary/40 hover:bg-muted/40",
                            )}
                          >
                            <div
                              className={cn(
                                "h-11 w-11 shrink-0 rounded-lg grid place-items-center bg-gradient-to-br",
                                k.accent,
                              )}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium">{k.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">
                                {k.desc}
                              </div>
                            </div>
                            <div
                              className={cn(
                                "h-5 w-5 shrink-0 rounded-full border grid place-items-center transition-all",
                                selected
                                  ? "border-primary bg-primary text-primary-foreground"
                                  : "border-border",
                              )}
                            >
                              {selected && <Check className="h-3 w-3" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Nom complet</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      required
                    />
                  </div>

                  {accountKind === "dg" && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Label htmlFor="companyName">Nom de l'entreprise</Label>
                      <Input
                        id="companyName"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ma société"
                        required
                      />
                      {reservedInfo.reserved ? (
                        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-1.5">
                          <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            « {reservedInfo.displayName} » est un nom protégé
                          </div>
                          <p className="text-amber-800/80 dark:text-amber-200/80">
                            Pour éviter l'usurpation d'identité, seul un représentant vérifié peut créer cet espace.
                            Créez d'abord votre compte, puis soumettez un justificatif depuis « Mon entreprise ».
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Vous pourrez inviter vos employés juste après.
                        </p>
                      )}
                    </div>
                  )}


                  {accountKind === "employee" && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Label htmlFor="joinCompany">Votre entreprise</Label>
                      <Select value={joinCompanyId} onValueChange={setJoinCompanyId}>
                        <SelectTrigger id="joinCompany">
                          <SelectValue placeholder="Rechercher votre entreprise…" />
                        </SelectTrigger>
                        <SelectContent>
                          {(companies ?? []).length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              Aucune entreprise enregistrée pour l'instant.
                            </div>
                          ) : (
                            (companies ?? []).map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Votre compte sera rattaché automatiquement.
                      </p>
                    </div>
                  )}
                </>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Mot de passe</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-primary hover:underline"
                      >
                        Oublié ?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                    minLength={mode === "signup" ? 8 : 6}
                  />
                  {mode === "signup" && (
                    <p className="text-xs text-muted-foreground">
                      Utilisez un mot de passe unique d'au moins 8 caractères. Les mots de passe déjà exposés dans des fuites sont refusés.
                    </p>
                  )}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {mode === "signin" && "Se connecter"}
                {mode === "signup" && "Créer le compte"}
                {mode === "forgot" && "Envoyer le lien"}
              </Button>
            </form>
            <div className="text-center text-sm text-muted-foreground">
              {mode === "signin" ? (
                <>
                  Pas encore de compte ?{" "}
                  <button
                    onClick={() => setMode("signup")}
                    className="text-primary hover:underline font-medium"
                  >
                    Créer un compte
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setMode("signin")}
                  className="text-primary hover:underline"
                >
                  Retour à la connexion
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
