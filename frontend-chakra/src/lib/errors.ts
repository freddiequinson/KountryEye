/** Turn an axios/API error into a short message for a toast. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = error as { response?: { status?: number; data?: { detail?: unknown } }; message?: string }
  const detail = e?.response?.data?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length) {
    // FastAPI validation errors: [{loc, msg}]
    const first = detail[0] as { loc?: unknown[]; msg?: string }
    const field = Array.isArray(first?.loc) ? String(first.loc[first.loc.length - 1]) : ''
    return field ? `${field}: ${first?.msg ?? 'invalid'}` : first?.msg ?? fallback
  }
  if (e?.response?.status === 403) return "You don't have permission to do this."
  if (e?.response?.status === 429) return 'Too many attempts. Please wait a few minutes.'
  if (!e?.response) return 'Cannot reach the server. Check your connection.'
  return fallback
}
