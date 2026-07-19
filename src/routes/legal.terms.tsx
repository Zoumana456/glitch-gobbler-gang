import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicNav, PublicFooter } from "./index";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation — DailyBrief" },
      {
        name: "description",
        content:
          "Conditions générales d'utilisation du service DailyBrief : engagements, responsabilités, propriété intellectuelle.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PublicNav authed={authed} />
      <main className="mx-auto max-w-3xl px-4 py-16 md:py-20">
        <h1 className="text-4xl font-semibold tracking-tight">Conditions générales d'utilisation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
        </p>

        <div className="mt-8 space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Objet</h2>
            <p className="text-muted-foreground">
              Les présentes conditions régissent l'utilisation de DailyBrief, plateforme de
              gestion de rapports quotidiens et procès-verbaux. En créant un compte, vous les
              acceptez sans réserve.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">2. Compte utilisateur</h2>
            <p className="text-muted-foreground">
              Vous êtes responsable de la confidentialité de vos identifiants et de toutes les
              activités effectuées depuis votre compte. Vous vous engagez à fournir des
              informations exactes et à les tenir à jour.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">3. Usage acceptable</h2>
            <p className="text-muted-foreground">
              Il est interdit d'utiliser le service pour publier des contenus illégaux, usurper
              l'identité d'une entreprise ou d'une personne, ou compromettre la sécurité de la
              plateforme. Tout manquement peut entraîner la suspension ou la suppression du
              compte.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">4. Propriété intellectuelle</h2>
            <p className="text-muted-foreground">
              Vous conservez la pleine propriété des contenus que vous publiez. Vous nous
              accordez une licence limitée d'hébergement et d'affichage strictement nécessaire à
              la fourniture du service.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">5. Disponibilité et responsabilité</h2>
            <p className="text-muted-foreground">
              Nous mettons tout en œuvre pour garantir la disponibilité du service, sans pouvoir
              en garantir une continuité absolue. Notre responsabilité ne saurait être engagée
              pour tout dommage indirect résultant de son utilisation.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">6. Résiliation</h2>
            <p className="text-muted-foreground">
              Vous pouvez supprimer votre compte à tout moment depuis votre profil. Nous
              pouvons suspendre un compte en cas de violation des présentes conditions.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
