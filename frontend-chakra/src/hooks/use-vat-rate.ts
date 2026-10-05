import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

// VAT percentage the admin set in Settings > System (0 when unset). Added on top of base prices at sale time.
export function useVatRate(): number {
  const { data } = useQuery({
    queryKey: ['setting', 'vat_rate'],
    queryFn: async () => (await api.get('/settings/vat_rate')).data,
  })
  const rate = parseFloat(data?.value)
  return Number.isFinite(rate) && rate > 0 ? rate : 0
}
