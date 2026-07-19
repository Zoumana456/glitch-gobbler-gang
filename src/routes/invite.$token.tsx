import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getInvitationPreview, acceptInvitation } from "@/lib/company.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const previewFn = useServerFn(getInvitationPreview);
  const acceptFn = useServerFn(acceptInvitation);

  const [userId, setUserId] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setCheckingSession(false);
    });
  }, []);

  const { data: preview, isLoading } = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => previewFn({ data: { token } }),
  });

  const acceptMut = useMutation({
    mutationFn: () => acceptFn({ data: { token } }),
    onSuccess: (res: any) => {
      toast.success(`Bienvenue chez ${res.companyName} !`);
      navigate({ to: "/company" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  if (isLoading || checkingSession) return <div className="p-8">Chargement...</div>;
  if (!preview) {
    return (
      <div className="max-w-md mx-auto p-8">
        <Card>
          <CardContent className="pt-6">Invitation introuvable ou expirée.</CardContent>
        </Card>
      </div>
    );
  }

  const expired = new Date(preview.expires_at) < new Date();
  const invalid = preview.status !== "pending" || expired;

  return (
    <div className="max-w-md mx-auto p-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Invitation entreprise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>
            Vous êtes invité à rejoindre <strong>{preview.company_name}</strong> en
            tant qu'employé.
          </p>
          <p className="text-sm text-muted-foreground">Email : {preview.email}</p>
          {invalid ? (
            <p className="text-sm text-destructive">
              {expired ? "Cette invitation a expiré." : "Cette invitation n'est plus valide."}
            </p>
          ) : !userId ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Connectez-vous ou créez un compte avec l'email <strong>{preview.email}</strong> pour accepter.
              </p>
              <Button asChild>
                <Link to="/auth" search={{ redirect: `/invite/${token}` } as any}>
                  Se connecter
                </Link>
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => acceptMut.mutate()}
              disabled={acceptMut.isPending}
            >
              Rejoindre l'entreprise
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
