import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { FileText, FileSignature, Users, Building2, Loader2 } from "lucide-react";
import { globalSearch, type SearchResult } from "@/lib/search.functions";

const ICONS = {
  report: FileText,
  minute: FileSignature,
  member: Users,
  company: Building2,
} as const;

const LABELS = {
  report: "Rapports",
  minute: "Procès-verbaux",
  member: "Employés",
  company: "Entreprises",
} as const;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const search = useServerFn(globalSearch);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const trimmed = query.trim();
  const { data, isFetching } = useQuery({
    queryKey: ["global-search", trimmed],
    queryFn: () => search({ data: { query: trimmed } }),
    enabled: trimmed.length >= 2,
    staleTime: 15_000,
  });

  const grouped = groupResults(data ?? []);

  function go(href: string) {
    setOpen(false);
    setQuery("");
    navigate({ to: href });
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Rechercher rapports, PV, employés, entreprises…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {trimmed.length < 2 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Tapez au moins 2 caractères pour rechercher…
          </div>
        ) : isFetching ? (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Recherche…
          </div>
        ) : (
          <>
            <CommandEmpty>Aucun résultat.</CommandEmpty>
            {(Object.keys(grouped) as Array<keyof typeof grouped>).map(
              (kind, idx) => {
                const items = grouped[kind];
                if (!items || items.length === 0) return null;
                const Icon = ICONS[kind];
                return (
                  <div key={kind}>
                    {idx > 0 && <CommandSeparator />}
                    <CommandGroup heading={LABELS[kind]}>
                      {items.map((r) => (
                        <CommandItem
                          key={`${r.kind}-${r.id}`}
                          value={`${r.title} ${r.subtitle ?? ""}`}
                          onSelect={() => go(r.href)}
                        >
                          <Icon className="h-4 w-4 mr-2 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{r.title}</div>
                            {r.subtitle && (
                              <div className="text-xs text-muted-foreground truncate">
                                {r.subtitle}
                              </div>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </div>
                );
              },
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

function groupResults(results: SearchResult[]) {
  const out: Record<SearchResult["kind"], SearchResult[]> = {
    report: [],
    minute: [],
    member: [],
    company: [],
  };
  for (const r of results) out[r.kind].push(r);
  return out;
}
