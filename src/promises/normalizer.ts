const DAY_MS = 24 * 60 * 60 * 1000;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

export function normalizeTimeframe(
  relativeTerm: string,
  referenceDate: string
): { earliest: string; latest: string } {
  const ref = new Date(`${referenceDate}T00:00:00.000Z`);
  if (Number.isNaN(ref.getTime())) {
    throw new Error(`Invalid referenceDate: ${referenceDate}`);
  }

  const term = relativeTerm.trim().toLowerCase();
  let earliestDate: Date;
  let latestDate: Date;

  if (term === "next visit") {
    earliestDate = addDays(ref, 14);
    latestDate = addDays(ref, 42);
  } else if (term === "soon") {
    earliestDate = addDays(ref, 7);
    latestDate = addDays(ref, 14);
  } else if (term === "a few weeks") {
    earliestDate = addDays(ref, 14);
    latestDate = addDays(ref, 28);
  } else if (term === "a few months") {
    earliestDate = addMonths(ref, 2);
    latestDate = addMonths(ref, 4);
  } else {
    const match = term.match(/in\s+(\d+)\s+(day|days|week|weeks|month|months)\b/);

    if (!match) {
      earliestDate = addDays(ref, 14);
      latestDate = addDays(ref, 42);
    } else {
      const value = Number(match[1]);
      const unit = match[2];

      if (unit.startsWith("day")) {
        earliestDate = addDays(ref, Math.max(value - 3, 0));
        latestDate = addDays(ref, value + 3);
      } else if (unit.startsWith("week")) {
        const baseDays = value * 7;
        earliestDate = addDays(ref, Math.max(baseDays - 7, 0));
        latestDate = addDays(ref, baseDays + 7);
      } else {
        const baseDate = addMonths(ref, value);
        earliestDate = addDays(baseDate, -14);
        latestDate = addDays(baseDate, 14);
      }
    }
  }

  if (daysBetween(ref, earliestDate) < 0) {
    earliestDate = ref;
  }

  return {
    earliest: toIsoDate(earliestDate),
    latest: toIsoDate(latestDate),
  };
}
