const DAY_MS = 24 * 60 * 60 * 1000;

export const WORD_TO_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
};

const MONTH_NAMES: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

function formatDate(date: Date): string {
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

function parseQuantity(raw: string): number | undefined {
  const lower = raw.toLowerCase();
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }
  return WORD_TO_NUM[lower];
}

/** Shared buffers: days ±3, weeks ±7, months ±14 around anchor. */
function rangeForIn(value: number, unit: string, ref: Date): { earliest: Date; latest: Date } {
  if (unit.startsWith("day")) {
    return {
      earliest: addDays(ref, Math.max(value - 3, 0)),
      latest: addDays(ref, value + 3),
    };
  }
  if (unit.startsWith("week")) {
    const baseDays = value * 7;
    return {
      earliest: addDays(ref, Math.max(baseDays - 7, 0)),
      latest: addDays(ref, baseDays + 7),
    };
  }
  const baseDate = addMonths(ref, value);
  return {
    earliest: addDays(baseDate, -14),
    latest: addDays(baseDate, 14),
  };
}

/** "within" uses a slightly tighter window: ±5 days for weeks instead of ±7 */
function rangeForWithinWeeks(value: number, ref: Date): { earliest: Date; latest: Date } {
  const baseDays = value * 7;
  return {
    earliest: addDays(ref, Math.max(baseDays - 5, 0)),
    latest: addDays(ref, baseDays + 5),
  };
}

/** Next calendar month window for "in April" style phrases. */
function yearForInMonth(ref: Date, targetMonthIndex: number): number {
  const y = ref.getUTCFullYear();
  const rm = ref.getUTCMonth();
  if (targetMonthIndex > rm) {
    return y;
  }
  if (targetMonthIndex < rm) {
    return y + 1;
  }
  return y;
}

/** Year for "by March" deadline = end of that month in the next applicable year. */
function yearForDeadlineMonth(ref: Date, targetMonthIndex: number): number {
  const y = ref.getUTCFullYear();
  const rm = ref.getUTCMonth();
  if (targetMonthIndex > rm) {
    return y;
  }
  if (targetMonthIndex < rm) {
    return y + 1;
  }
  return y;
}

function firstDayOfMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1));
}

function lastDayOfMonth(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex + 1, 0));
}

export interface TimeframePattern {
  regex: RegExp;
  calculate: (match: RegExpMatchArray, ref: Date) => { earliest: Date; latest: Date };
}

export const PATTERNS: TimeframePattern[] = [
  // Negative / non-specific → very wide window (regulatory: still bounded)
  {
    regex: /^(as\s+needed|prn|p\.r\.n\.|if\s+symptoms?\s+worsen)$/i,
    calculate: (_match, ref) => ({
      earliest: ref,
      latest: addDays(ref, 365),
    }),
  },
  // Digits: in N ...
  {
    regex: /^in\s+(\d+)\s+(days?|weeks?|months?)$/i,
    calculate: (match, ref) => rangeForIn(Number(match[1]), match[2], ref),
  },
  // Words: in three weeks ...
  {
    regex: /^in\s+(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(days?|weeks?|months?)$/i,
    calculate: (match, ref) => {
      const n = parseQuantity(match[1]);
      if (n === undefined) {
        return { earliest: addDays(ref, 14), latest: addDays(ref, 42) };
      }
      return rangeForIn(n, match[2], ref);
    },
  },
  // within (the next) N ...
  {
    regex: /^within\s+(?:the\s+next\s+)?(\d+)\s+(days?|weeks?|months?)$/i,
    calculate: (match, ref) => {
      const n = Number(match[1]);
      const u = match[2];
      if (u.startsWith("week")) {
        return rangeForWithinWeeks(n, ref);
      }
      return rangeForIn(n, u, ref);
    },
  },
  {
    regex:
      /^within\s+(?:the\s+next\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(days?|weeks?|months?)$/i,
    calculate: (match, ref) => {
      const n = parseQuantity(match[1]);
      if (n === undefined) {
        return { earliest: addDays(ref, 14), latest: addDays(ref, 42) };
      }
      const u = match[2];
      if (u.startsWith("week")) {
        return rangeForWithinWeeks(n, ref);
      }
      return rangeForIn(n, u, ref);
    },
  },
  // after N ...
  {
    regex: /^after\s+(?:the\s+)?(\d+)\s+(days?|weeks?|months?)$/i,
    calculate: (match, ref) => rangeForIn(Number(match[1]), match[2], ref),
  },
  {
    regex:
      /^after\s+(?:the\s+)?(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(days?|weeks?|months?)$/i,
    calculate: (match, ref) => {
      const n = parseQuantity(match[1]);
      if (n === undefined) {
        return { earliest: addDays(ref, 14), latest: addDays(ref, 42) };
      }
      return rangeForIn(n, match[2], ref);
    },
  },
  {
    regex: /^at\s+next\s+visit$/i,
    calculate: (_match, ref) => ({ earliest: addDays(ref, 14), latest: addDays(ref, 42) }),
  },
  {
    regex: /^at\s+follow[- ]?up$/i,
    calculate: (_match, ref) => ({ earliest: addDays(ref, 14), latest: addDays(ref, 42) }),
  },
  {
    regex: /^next\s+visit$/i,
    calculate: (_match, ref) => ({ earliest: addDays(ref, 14), latest: addDays(ref, 42) }),
  },
  {
    regex: /^soon$/i,
    calculate: (_match, ref) => ({ earliest: addDays(ref, 7), latest: addDays(ref, 14) }),
  },
  {
    regex: /^a\s+few\s+weeks$/i,
    calculate: (_match, ref) => ({ earliest: addDays(ref, 14), latest: addDays(ref, 28) }),
  },
  {
    regex: /^a\s+few\s+months$/i,
    calculate: (_match, ref) => ({ earliest: addMonths(ref, 2), latest: addMonths(ref, 4) }),
  },
  {
    regex: /^today$/i,
    calculate: (_match, ref) => ({ earliest: ref, latest: addDays(ref, 1) }),
  },
  {
    regex: /^tomorrow$/i,
    calculate: (_match, ref) => ({ earliest: addDays(ref, 1), latest: addDays(ref, 2) }),
  },
  {
    regex: /^this\s+week$/i,
    calculate: (_match, ref) => ({ earliest: ref, latest: addDays(ref, 7) }),
  },
  {
    regex: /^next\s+week$/i,
    calculate: (_match, ref) => ({ earliest: addDays(ref, 7), latest: addDays(ref, 14) }),
  },
  {
    regex: /^next\s+month$/i,
    calculate: (_match, ref) => ({ earliest: addDays(ref, 28), latest: addDays(ref, 42) }),
  },
  {
    regex: /^(annually|yearly)$/i,
    calculate: (_match, ref) => ({
      earliest: addMonths(ref, 11),
      latest: addMonths(ref, 13),
    }),
  },
  {
    regex: /^quarterly$/i,
    calculate: (_match, ref) => ({
      earliest: addDays(ref, 75),
      latest: addDays(ref, 105),
    }),
  },
  {
    regex: /^(biweekly|every\s+2\s+weeks)$/i,
    calculate: (_match, ref) => ({
      earliest: addDays(ref, 12),
      latest: addDays(ref, 16),
    }),
  },
  // in [month] — full calendar month in resolved year
  {
    regex: /^in\s+(january|february|march|april|may|june|july|august|september|october|november|december)$/i,
    calculate: (match, ref) => {
      const idx = MONTH_NAMES[match[1].toLowerCase()];
      const year = yearForInMonth(ref, idx);
      return {
        earliest: firstDayOfMonth(year, idx),
        latest: lastDayOfMonth(year, idx),
      };
    },
  },
  // by [month] — from ref through end of that month
  {
    regex: /^by\s+(january|february|march|april|may|june|july|august|september|october|november|december)$/i,
    calculate: (match, ref) => {
      const idx = MONTH_NAMES[match[1].toLowerCase()];
      const year = yearForDeadlineMonth(ref, idx);
      const last = lastDayOfMonth(year, idx);
      return {
        earliest: ref,
        latest: last,
      };
    },
  },
  {
    regex: /^by\s+end\s+of\s+(january|february|march|april|may|june|july|august|september|october|november|december)$/i,
    calculate: (match, ref) => {
      const idx = MONTH_NAMES[match[1].toLowerCase()];
      const year = yearForDeadlineMonth(ref, idx);
      return {
        earliest: ref,
        latest: lastDayOfMonth(year, idx),
      };
    },
  },
];

export function normalizeTimeframe(
  relativeTerm: string,
  referenceDate: string
): { earliest: string; latest: string } | null {
  const ref = new Date(`${referenceDate}T00:00:00.000Z`);
  if (Number.isNaN(ref.getTime())) {
    return { earliest: referenceDate, latest: referenceDate };
  }

  const term = relativeTerm.trim();
  if (!term) {
    return null;
  }

  for (const pattern of PATTERNS) {
    const match = term.match(pattern.regex);
    if (match) {
      let { earliest, latest } = pattern.calculate(match, ref);
      if (daysBetween(ref, earliest) < 0) {
        earliest = ref;
      }
      return {
        earliest: formatDate(earliest),
        latest: formatDate(latest),
      };
    }
  }

  // Fallback: legacy "in N" with word boundaries inside longer strings
  const legacy = term.toLowerCase().match(/in\s+(\d+)\s+(day|days|week|weeks|month|months)\b/);
  if (legacy) {
    const { earliest, latest } = rangeForIn(Number(legacy[1]), legacy[2], ref);
    let e = earliest;
    if (daysBetween(ref, e) < 0) {
      e = ref;
    }
    return { earliest: formatDate(e), latest: formatDate(latest) };
  }

  return {
    earliest: formatDate(addDays(ref, 14)),
    latest: formatDate(addDays(ref, 42)),
  };
}

/** Default 2–6 week window when normalization returns null (caller supplies note date). */
export function defaultTimeframeFallback(referenceDate: string): { earliest: string; latest: string } {
  const ref = new Date(`${referenceDate}T00:00:00.000Z`);
  if (Number.isNaN(ref.getTime())) {
    return { earliest: referenceDate, latest: referenceDate };
  }
  return {
    earliest: formatDate(addDays(ref, 14)),
    latest: formatDate(addDays(ref, 42)),
  };
}
