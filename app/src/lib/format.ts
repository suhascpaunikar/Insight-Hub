/* ==========================================================================
   The formatting rules the rest of the prototype already follows, in TypeScript.

   Deliberately a copy of the handful of helpers in assets/js/core.js rather
   than an import of it: those live inside a module that also owns the vanilla
   dropdowns, dialogs and toasts, none of which this page uses any more. The
   rules themselves must not drift, so each one is the same rule.
   ========================================================================== */

export const count = (n: number) => Number(n || 0).toLocaleString("en-US")

/** FR-79 — one decimal place, everywhere a rating is printed. */
export const ratingText = (n: number) => Number(n || 0).toFixed(1)

export const percent = (n: number, digits = 1) => `${Number(n || 0).toFixed(digits)}%`

export function absoluteTime(iso: string, withTime = true) {
  const d = new Date(iso)
  const date = d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  if (!withTime) return date
  return `${date}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
}

/** FR-80 — recent edits read as elapsed time, older ones fall back to a date. */
export function relativeTime(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  if (days <= 6) return `${days} day${days === 1 ? "" : "s"} ago`
  return absoluteTime(iso, false)
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/* ---------- Rating ramp (FR-79 / FR-89) ----------
   Five stops, red → emerald, normalised to whichever rating element the
   campaign uses (star 1–5, NPS 1–5, NPS 1–10), so a colour reads identically
   on this list, on the distribution bars and on the driver rows. */
const RAMP = ["#e5484d", "#f76b15", "#ffb224", "#7cc47f", "#3ecf8e"]

const hexToRgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export function ratingColor(value: number, max = 5) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    return "var(--muted-strong)"
  }
  const norm = clamp(((Number(value) - 1) / (max - 1)) * 4 + 1, 1, 5)
  const lo = Math.floor(norm)
  const hi = Math.min(5, lo + 1)
  const t = norm - lo
  const a = hexToRgb(RAMP[lo - 1])
  const b = hexToRgb(RAMP[hi - 1])
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(", ")})`
}
