import {
  createFileRoute,
  Outlet,
  redirect,
  Link,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, FilePlus2, UserCircle2, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

const NAV = [
  { to: "/reports", label: "Rapports", icon: FileText },
  { to: "/reports/new", label: "Nouveau rapport", icon: FilePlus2 },
  { to: "/profile", label: "Profil", icon: UserCircle2 },
] as const;

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [router.state.location.pathname]);

  async function handleSignOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      toast.success("Déconnecté");
      router.navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur de déconnexion");
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex md:w-64 shrink-0 border-r border-border bg-sidebar text-sidebar-foreground flex-col">
        <SidebarInner email={user.email ?? ""} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="font-semibold">Menu</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <SidebarInner email={user.email ?? ""} onSignOut={handleSignOut} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background px-4 py-3">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link to="/reports" className="flex items-center gap-2 font-semibold">
            <FileText className="h-5 w-5 text-primary" />
            Lovable Rapports
          </Link>
        </header>
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function SidebarInner({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  return (
    <>
      <div className="px-5 pt-6 pb-4">
        <Link to="/reports" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">Lovable</div>
            <div className="text-xs text-muted-foreground leading-tight">Rapports d'équipe</div>
          </div>
        </Link>
      </div>
      <nav className="px-3 space-y-1 flex-1">
        {NAV.map((item) => {
          const active =
            item.to === "/reports"
              ? pathname === "/reports"
              : pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <div className="px-2 text-xs text-muted-foreground truncate" title={email}>
          {email}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start"
          onClick={onSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Se déconnecter
        </Button>
      </div>
    </>
  );
}
