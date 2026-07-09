import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export function formatLongDate(iso: string): string {
  try {
    return format(parseISO(iso), "d MMMM yyyy", { locale: fr });
  } catch {
    return iso;
  }
}

export function formatShortDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: fr });
  } catch {
    return iso;
  }
}

export function todayIso(): string {
  return format(new Date(), "yyyy-MM-dd");
}
