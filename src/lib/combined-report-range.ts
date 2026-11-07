import { differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

/** Native date inputs may be empty while the user edits them. */
export function combinedReportRange(start: string, end: string) {
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value));
  if (!validDate(start) || !validDate(end)) return null;
  const [a, b] = start <= end ? [start, end] : [end, start];
  const days = differenceInCalendarDays(parseISO(b), parseISO(a)) + 1;
  const fmt = (d: string) => format(parseISO(d), "d MMM yyyy", { locale: fr });
  const title = `${days === 7 ? "Rapport hebdomadaire" : `Rapport combiné — ${days} jour${days > 1 ? "s" : ""}`} — du ${fmt(a)} au ${fmt(b)}`;
  const instructions = `Rapport consolidé sur ${days} jour(s) (${fmt(a)} → ${fmt(b)}) : synthèse globale et progression jour par jour, à partir des rapports journaliers, projets, tâches et dépenses. Faits marquants, réalisations, difficultés, chiffres clés, perspectives.`;
  return { start: a, end: b, days, title, instructions };
}