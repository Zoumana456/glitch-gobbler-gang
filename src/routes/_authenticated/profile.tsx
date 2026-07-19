import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/reports.functions";
import { listMyVerificationRequests } from "@/lib/reserved-names.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RequestVerificationDialog } from "@/components/RequestVerificationDialog";
import { toast } from "sonner";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profil — DailyBrief" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const updateProfile = useServerFn(updateMyProfile);
  const q = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const listVerif = useServerFn(listMyVerificationRequests);
  const verif = useQuery({ queryKey: ["my-verification-requests"], queryFn: () => listVerif() });
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifCompany, setVerifCompany] = useState("");
  const [verifOpen, setVerifOpen] = useState(false);

  useEffect(() => {
    if (q.data) setFullName(q.data.full_name ?? "");
  }, [q.data]);

  const mut = useMutation({
    mutationFn: (payload: { full_name?: string; avatar_url?: string | null }) =>
      updateProfile({ data: payload }),
    onSuccess: () => {
      toast.success("Profil mis à jour");
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Mise à jour impossible"),
    onSettled: () => setSaving(false),
  });

  async function handleSave() {
    setSaving(true);
    mut.mutate({ full_name: fullName });
  }

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Déconnecté");
    router.navigate({ to: "/auth", replace: true });
  }

  async function handleAvatarPick(file: File) {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? "";
    const path = `${uid}/avatar-${Date.now()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage
      .from("report-images")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      toast.error("Envoi impossible : " + error.message);
      return;
    }
    const { data } = await supabase.storage.from("report-images").createSignedUrl(path, 60 * 60 * 24 * 365);
    mut.mutate({ avatar_url: data?.signedUrl ?? null });
  }

  const p = q.data;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Profil</h1>
        <p className="text-muted-foreground mt-1">Gérez vos informations personnelles.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={p?.avatar_url ?? undefined} />
              <AvatarFallback>
                {(p?.full_name ?? p?.email ?? "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleAvatarPick(f);
                  e.target.value = "";
                }}
              />
              <span className="text-sm text-primary hover:underline">
                Changer l'avatar
              </span>
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={p?.email ?? ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nom complet</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-5 flex items-center justify-between">
          <div>
            <div className="font-medium">Déconnexion</div>
            <div className="text-sm text-muted-foreground">
              Terminer votre session sur cet appareil.
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
