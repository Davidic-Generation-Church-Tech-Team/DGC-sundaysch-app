import type { Router } from "expo-router";
import { fetchManualDetailById, toCompatManual, type CompatManual } from "./hygraph";

// The list screens only hold summary fields; the rich content is fetched for
// the one manual being opened. On a failed fetch we still open with what we
// have, so a flaky connection never blocks reading.
async function withFullContent(manual: CompatManual): Promise<CompatManual> {
  try {
    const raw = await fetchManualDetailById(manual.id);
    return raw ? toCompatManual(raw, manual.order) : manual;
  } catch (error) {
    console.error("Error fetching manual detail:", error);
    return manual;
  }
}

// 4 January has its own layout; every other manual uses the standard one.
function detailPathFor(manual: CompatManual) {
  return manual.studyDate.endsWith("-01-04") ? "/Home/January4ManualDetail" : "/Home/ManualDetail";
}

// Fetches the full manual, opens its detail screen, and resolves with the
// loaded manual (callers use it to remember "last read").
export async function openManual(router: Router, manual: CompatManual): Promise<CompatManual> {
  const full = await withFullContent(manual);
  router.push({ pathname: detailPathFor(full), params: { manual: JSON.stringify(full) } });
  return full;
}
