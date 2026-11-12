import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { parseISODate } from "./hygraph";

// A manual is for a Sunday class (`studyDate`) and opens two days earlier —
// Friday at 00:00 device-local time. Once opened it stays open for good, so
// past manuals are always readable. Anything that opens later is locked.
export const UNLOCK_DAYS_BEFORE_STUDY = 2;

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Dated = { studyDate: string };

// The moment a manual opens: local midnight, UNLOCK_DAYS_BEFORE_STUDY days
// before its study date. Built from y/m/d parts so no timezone shifts it.
export function getUnlockDate(studyDate: string): Date | null {
  const parsed = parseISODate(studyDate);
  if (!parsed) return null;
  return new Date(parsed.year, parsed.month - 1, parsed.day - UNLOCK_DAYS_BEFORE_STUDY);
}

export function isManualUnlocked(manual: Dated, now: Date = new Date()): boolean {
  const unlockAt = getUnlockDate(manual.studyDate);
  // No usable date → keep it locked rather than leak an unscheduled manual.
  return !!unlockAt && now.getTime() >= unlockAt.getTime();
}

// "Opens Friday, 9 Jan" — shown on locked manuals.
export function getOpensLabel(manual: Dated): string {
  const unlockAt = getUnlockDate(manual.studyDate);
  if (!unlockAt) return "Not scheduled yet";
  return `Opens ${WEEKDAYS[unlockAt.getDay()]}, ${unlockAt.getDate()} ${MONTHS_SHORT[unlockAt.getMonth()]}`;
}

function msUntilNextMidnight(now: Date): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}

// Current time that refreshes at every local midnight and whenever the app
// returns to the foreground — so a manual flips from locked to open on
// Friday even if the app was left running (or backgrounded) since Thursday.
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      // +1s so we land just after midnight, never just before it.
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msUntilNextMidnight(new Date()) + 1000);
    };
    schedule();

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      setNow(new Date());
      clearTimeout(timer);
      schedule();
    });

    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return now;
}
