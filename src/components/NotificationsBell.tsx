import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications.functions";

function relative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "hier" : `il y a ${d} j`;
}

export function NotificationsBell({ collapsed = false }: { collapsed?: boolean }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const listFn = useServerFn(listMyNotifications);
  const readFn = useServerFn(markNotificationRead);
  const readAllFn = useServerFn(markAllNotificationsRead);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const unread = items.filter((n) => !n.read_at).length;

  async function handleOpenItem(id: string, alreadyRead: boolean) {
    setOpen(false);
    if (alreadyRead) return;
    try {
      await readFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {}
  }

  async function handleReadAll() {
    try {
      await readAllFn();
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch {}
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className={cn(
            "relative",
            collapsed ? "mx-auto flex h-9 w-9" : "w-full justify-start",
          )}
          aria-label={
            unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"
          }
          title="Notifications"
        >
          <Bell className={cn("h-4 w-4 shrink-0", !collapsed && "mr-2")} />
          {!collapsed && <span className="truncate">Notifications</span>}
          {unread > 0 && (
            <span
              className={cn(
                "absolute inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground",
                collapsed ? "right-1 top-1" : "right-2 top-1.5",
              )}
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={handleReadAll}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tout marquer lu
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Aucune notification pour le moment.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => {
                const content = (
                  <div
                    className={cn(
                      "px-3 py-2.5 text-left transition-colors hover:bg-accent/60",
                      !n.read_at && "bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.body && (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {relative(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.report_id ? (
                      <Link
                        to="/reports/$id"
                        params={{ id: n.report_id }}
                        onClick={() => handleOpenItem(n.id, !!n.read_at)}
                        className="block"
                      >
                        {content}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full"
                        onClick={() => handleOpenItem(n.id, !!n.read_at)}
                      >
                        {content}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
