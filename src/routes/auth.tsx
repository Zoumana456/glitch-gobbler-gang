import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";

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

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

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
      toast.error(err?.message ?? "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Connexion Google impossible");
        setLoading(false);
        return;
      }
      if (result.redirected) return; // browser navigates away
      navigate({ to: redirect ?? "/reports", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Connexion Google impossible");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted px-4">
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
            {mode !== "forgot" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogle}
                  disabled={loading}
                >
                  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285f4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34a853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fbbc04"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#ea4335"/>
                  </svg>
                  Continuer avec Google
                </Button>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">ou</span>
                  </div>
                </div>
              </>
            )}
            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
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
                    minLength={6}
                  />
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
