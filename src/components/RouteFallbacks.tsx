import { Link, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileQuestion, Home, RotateCcw } from "lucide-react";

/** Écran d'erreur partagé par toutes les pages. */
export function RouteErrorFallback({
  error,
  reset,
}: {
  error?: Error;
  reset?: () => void;
}) {
  const router = useRouter();
  if (error) console.error(error);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">
          Cette page n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur est survenue, souvent liée à la connexion. Réessayez ou
          revenez à vos rapports.
        </p>
        {error?.message && (
          <p className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground break-words">
            {error.message}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              router.invalidate();
              reset?.();
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Réessayer
          </Button>
          <Button variant="outline" asChild>
            <Link to="/reports">
              <Home className="mr-2 h-4 w-4" />
              Mes rapports
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Écran « page introuvable » partagé par toutes les pages. */
export function RouteNotFoundFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Page introuvable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cette page n'existe pas, a été déplacée, ou vous n'y avez pas accès.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/reports">
              <Home className="mr-2 h-4 w-4" />
              Mes rapports
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Accueil</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
