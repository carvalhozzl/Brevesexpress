const DEFAULT_TZ = "America/Sao_Paulo";

export function formatDateTime(iso: string | Date, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(iso));
}

export function formatTime(iso: string | Date, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(iso));
}

/** "45 s", "3 min", "1 h 05 min" */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "—";
  const s = Math.max(0, Math.round(totalSeconds));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  if (minutes < 60) {
    const rest = s % 60;
    return minutes < 10 && rest ? `${minutes} min ${String(rest).padStart(2, "0")} s` : `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** Cronômetro compacto mm:ss / h:mm:ss */
export function formatElapsed(fromIso: string, now: number = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatBRL(cents: number | null | undefined): string | null {
  if (cents == null) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

/** Início do dia (00:00) no fuso indicado, em UTC ISO. */
export function startOfDayInTimeZone(date: Date, timeZone = DEFAULT_TZ): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // YYYY-MM-DD
  return zonedDateToUtc(parts, "00:00", timeZone);
}

/** Converte "YYYY-MM-DD" + "HH:mm" no fuso indicado para Date (UTC). */
export function zonedDateToUtc(day: string, time: string, timeZone = DEFAULT_TZ): Date {
  const [y, mo, d] = day.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi));
  const offset = timeZoneOffsetMs(guess, timeZone);
  const result = new Date(guess.getTime() - offset);
  // corrige transições de horário de verão
  const offset2 = timeZoneOffsetMs(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2);
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Data local (YYYY-MM-DD) no fuso indicado. */
export function localDay(date: Date, timeZone = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Intervalo "hoje" no fuso do restaurante: [00:00 local, agora + 1 min). */
export function todayRange(timeZone = DEFAULT_TZ, now = new Date()): { start: Date; end: Date } {
  return { start: startOfDayInTimeZone(now, timeZone), end: new Date(now.getTime() + 60_000) };
}
