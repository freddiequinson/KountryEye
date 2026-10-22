/** Money helpers. Prices are entered without VAT; VAT is added on top. */

export const ghs = (amount: number | null | undefined) =>
  `GH₵${(Number(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Round half-up to the pesewa, the same way the server does. */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export const vatOn = (net: number, rate: number) => round2((net * rate) / 100)
export const withVat = (net: number, rate: number) => round2(net + vatOn(net, rate))

type VisitMoney = { consultation_fee?: number | null; vat_amount?: number | null; total_amount?: number | null; amount_paid?: number | null; balance?: number | null }

/** What the patient is billed for a visit (fee + VAT). Older visits have no VAT. */
export const visitTotal = (v: VisitMoney) => v.total_amount ?? round2((v.consultation_fee || 0) + (v.vat_amount || 0))
export const visitBalance = (v: VisitMoney) => v.balance ?? Math.max(round2(visitTotal(v) - (v.amount_paid || 0)), 0)
