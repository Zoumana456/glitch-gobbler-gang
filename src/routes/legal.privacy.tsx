import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PublicNav, PublicFooter } from "../index";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — DailyBrief" },
      {
        name: "description",
        content:
          "Politique de confidentialité de DailyBrief : quelles données nous collectons, comment nous les protégeons et vos droits.",
      },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <PublicNav authed={authed} />
      <main className="mx-auto max-w-3xl px-4 py-16 md:py-20">
        <h1 className="text-4xl font-semibold tracking-tight">Politique de confidentialité</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-xl font-semibold">1. Données collectées</h2>
            <p className="text-muted-foreground">
              Nous collectons les données strictement nécessaires au fonctionnement du service :
              nom, adresse email, informations d'entreprise, contenu des rapports et procès-verbaux
              que vous rédigez, ainsi que les documents que vous téléversez (justificatifs KYC,
              pièces jointes).
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">2. Finalités du traitement</h2>
            <p className="text-muted-foreground">
              Vos données sont utilisées pour : fournir le service, permettre le partage sécurisé
              entre membres d'une même entreprise, vérifier votre identité en cas de nom
              d'entreprise protégé, et respecter nos obligations légales.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">3. Sécurité</h2>
            <p className="text-muted-foreground">
              Les données sont hébergées sur une infrastructure certifiée avec chiffrement en
              transit (TLS) et au repos. L'accès à vos rapports est protégé par des règles de
              sécurité (RLS) qui garantissent que seuls vous et les membres autorisés de votre
              entreprise peuvent y accéder.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">4. Partage avec des tiers</h2>
            <p className="text-muted-foreground">
              Nous ne revendons jamais vos données. Nos sous-traitants (hébergement, envoi
              d'email, service IA) traitent vos données uniquement pour notre compte et sont
              soumis à des engagements contractuels de confidentialité.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">5. Vos droits</h2>
            <p className="text-muted-foreground">
              Vous disposez d'un droit d'accès, de rectification, de suppression et de portabilité
              de vos données. Pour l'exercer, contactez-nous à l'adresse indiquée dans vos
              paramètres de compte.
            </p>
          </section>
          <section>
            <h2 className="text-xl font-semibold">6. Conservation</h2>
            <p className="text-muted-foreground">
              Les données sont conservées tant que votre compte est actif. En cas de suppression
              de compte, elles sont supprimées dans un délai de 30 jours, sauf obligations légales
              contraires.
            </p>
          </section>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
