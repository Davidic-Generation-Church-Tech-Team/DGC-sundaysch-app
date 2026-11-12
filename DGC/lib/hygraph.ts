// Manuals now come straight from the Hygraph CMS (GraphQL) instead of the
// old dgc-backend REST API — that backend only ever had a handful of months
// populated with gaps; Hygraph has the full, continuously-updated curriculum.
const HYGRAPH_URL = "https://eu-west-2.cdn.hygraph.com/content/cmir5z9ga02wg06uv7654e2kq/master";
const REQUEST_TIMEOUT_MS = 15000;

export interface HygraphBook {
  title: string;
  author: string;
}

export interface HygraphManual {
  id: string;
  title: string;
  theme: string | null;
  studyDate: string; // "YYYY-MM-DD"
  memoryVerse: string;
  scriptureText: string;
  conclusion?: string;
  content?: { html: string } | null;
  classDiscussion?: { html: string } | null;
  assignment?: { html: string } | null;
  declarations?: { html: string } | null;
  image?: { url: string } | null;
  books?: HygraphBook[];
}

async function hygraphRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(HYGRAPH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error("Could not reach the manuals server. Check your internet connection and try again.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) throw new Error(`Manuals request failed (${response.status})`);

  const json = await response.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message || "Failed to load manuals.");
  return json.data as T;
}

// Kept deliberately light — no rich-text/books fields — since this is what
// loads eagerly for the whole list every time the Manuals tab (or the Home
// "Recommended" section) mounts. The heavy fields (content, classDiscussion,
// assignment, declarations, books) are fetched one at a time, only for the
// single manual someone actually opens — see fetchManualDetailById below.
const SUMMARY_FIELDS = `
  id
  title
  theme
  studyDate
  memoryVerse
  scriptureText
  image { url }
`;

const FULL_FIELDS = `
  ${SUMMARY_FIELDS}
  content { html }
  classDiscussion { html }
  assignment { html }
  conclusion
  books { title author }
  declarations { html }
`;

let summaryCache: HygraphManual[] | null = null;
let summaryCachePromise: Promise<HygraphManual[]> | null = null;

// Fetches the lightweight list once per app session and reuses it after
// that — re-opening the Manuals tab or coming back to Home no longer
// re-fetches everything from scratch every single time.
export async function fetchAllManualsFromHygraph(): Promise<HygraphManual[]> {
  if (summaryCache) return summaryCache;
  if (!summaryCachePromise) {
    summaryCachePromise = hygraphRequest<{ manuals: HygraphManual[] }>(`
      query ManualSummaries {
        manuals(first: 200, orderBy: studyDate_ASC) {
          ${SUMMARY_FIELDS}
        }
      }
    `)
      .then((data) => {
        summaryCache = Array.isArray(data?.manuals) ? data.manuals : [];
        return summaryCache;
      })
      .catch((err) => {
        summaryCachePromise = null; // don't poison future attempts after a failed fetch
        throw err;
      });
  }
  return summaryCachePromise;
}

const detailCache = new Map<string, HygraphManual>();

// Fetches the full manual — including the rich-text/books fields the list
// deliberately skips — for exactly the one manual being opened.
export async function fetchManualDetailById(id: string): Promise<HygraphManual | null> {
  const cached = detailCache.get(id);
  if (cached) return cached;

  const data = await hygraphRequest<{ manual: HygraphManual | null }>(
    `
      query ManualDetail($id: ID!) {
        manual(where: { id: $id }) {
          ${FULL_FIELDS}
        }
      }
    `,
    { id }
  );

  if (data?.manual) detailCache.set(id, data.manual);
  return data?.manual ?? null;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const ORDINAL_SUFFIX = (day: number) => {
  if (day % 10 === 1 && day !== 11) return "st";
  if (day % 10 === 2 && day !== 12) return "nd";
  if (day % 10 === 3 && day !== 13) return "rd";
  return "th";
};

// studyDate is a bare "YYYY-MM-DD" — parsed manually rather than
// `new Date(str)` so it never shifts a day under a negative UTC offset.
export function parseISODate(iso: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  if (!match) return null;
  return { year: parseInt(match[1], 10), month: parseInt(match[2], 10), day: parseInt(match[3], 10) };
}

export function monthNameFromISO(iso: string): string {
  const parsed = parseISODate(iso);
  return parsed ? MONTH_NAMES[parsed.month - 1] : "";
}

// Reproduces the old REST API's "4th January, 2026" date string so it stays
// compatible with the existing card/detail rendering and the January-4th
// special-case dispatch in outline.tsx, without touching either.
export function formatOldStyleDate(iso: string): string {
  const parsed = parseISODate(iso);
  if (!parsed) return iso;
  return `${parsed.day}${ORDINAL_SUFFIX(parsed.day)} ${MONTH_NAMES[parsed.month - 1]}, ${parsed.year}`;
}

// Converts Hygraph's RichText HTML into readable plain text — the detail
// screens' text fields (introduction/classDiscussion/declaration) are plain
// <Text>, and their scripture-reference tap-to-view feature scans plain
// strings, so this keeps both working without a full HTML renderer.
export function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html
    .replace(/<li[^>]*>/gi, "\n• ")
    .replace(/<\/(p|div|h[1-6]|ul|ol|li|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// The shape every existing screen (outline.tsx's list, ManualDetail.tsx,
// January4ManualDetail.tsx) already expects — mapping into it here means
// none of those screens need to change at all for the new data source.
export interface CompatManual {
  _id: string;
  id: string;
  title: string;
  theme: string;
  memoryVerse: string;
  text: string;
  introduction: string;
  classDiscussion: string;
  conclusion: string;
  declaration?: string;
  month: string;
  date: string;
  studyDate: string; // raw "YYYY-MM-DD", used for unlock math
  order: number;
  imageUrl?: string;
  recommendedBooks: string[];
}

export function toCompatManual(raw: HygraphManual, order: number): CompatManual {
  return {
    _id: raw.id,
    id: raw.id,
    title: raw.title,
    theme: raw.theme || "",
    memoryVerse: raw.memoryVerse,
    text: raw.scriptureText || "",
    introduction: stripHtml(raw.content?.html),
    classDiscussion: stripHtml(raw.classDiscussion?.html),
    conclusion: raw.conclusion || "",
    declaration: raw.declarations?.html ? stripHtml(raw.declarations.html) : undefined,
    month: monthNameFromISO(raw.studyDate),
    date: formatOldStyleDate(raw.studyDate),
    studyDate: raw.studyDate,
    order,
    imageUrl: raw.image?.url,
    recommendedBooks: (raw.books || []).map((b) => (b.author ? `${b.title} — ${b.author}` : b.title)),
  };
}
