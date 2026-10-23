import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge, Box, Button, SimpleGrid, Table, Tbody, Td, Th, Thead, Tr, useColorModeValue } from '@chakra-ui/react'
import { MdAttachMoney, MdPointOfSale, MdReceipt } from 'react-icons/md'
import { SalesReceiptModal } from '@/components/SalesReceiptModal'
import api from '@/lib/api'
import type { Sale } from '@/types'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/card/Card'
import StatCard from '@/components/card/StatCard'
import { Pagination, TableMessageRow } from '@/components/ui'

const ITEMS_PER_PAGE = 20
const ghs = (n?: number) => n?.toLocaleString('en-US', { style: 'currency', currency: 'GHS' }) || 'GH₵0'

export default function SalesPage() {
  const navigate = useNavigate()
  const hoverBg = useColorModeValue('secondaryGray.300', 'whiteAlpha.100')
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['sales'],
    queryFn: async () => (await api.get('/sales')).data,
  })

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
  })

  const branchMap: Record<number, string> = Object.fromEntries(branches.map((b: any) => [b.id, b.name]))

  const totalPages = Math.ceil(sales.length / ITEMS_PER_PAGE)
  const paginatedSales = sales.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
  const todaySales = sales.filter((s: Sale) => new Date(s.created_at).toDateString() === new Date().toDateString())

  return (
    <>
      <PageHeader
        title="Sales"
        actions={
          <Button variant="brand" leftIcon={<MdPointOfSale />} onClick={() => navigate('/sales/pos')}>
            Open POS
          </Button>
        }
      />

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing="20px" mb="20px">
        <StatCard name="Today's Sales" value={ghs(todaySales.reduce((sum: number, s: Sale) => sum + s.total_amount, 0))} icon={MdAttachMoney} />
        <StatCard name="Transactions" value={todaySales.length} icon={MdReceipt} />
      </SimpleGrid>

      <Card>
        <Box overflowX="auto">
          <Table variant="simple" sx={{ td: { whiteSpace: 'nowrap' } }}>
            <Thead>
              <Tr>
                <Th>Receipt No.</Th>
                <Th>Date</Th>
                <Th>Branch</Th>
                <Th>Subtotal</Th>
                <Th>Discount</Th>
                <Th>Total</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {isLoading ? (
                <TableMessageRow colSpan={8} loading />
              ) : paginatedSales.length === 0 ? (
                <TableMessageRow colSpan={8}>No sales found</TableMessageRow>
              ) : (
                paginatedSales.map((sale: Sale) => (
                  <Tr
                    key={sale.id}
                    cursor="pointer"
                    _hover={{ bg: hoverBg }}
                    onClick={() => {
                      setSelectedSale(sale)
                      setIsReceiptOpen(true)
                    }}
                  >
                    <Td fontWeight="600">{sale.receipt_number}</Td>
                    <Td>{new Date(sale.created_at).toLocaleString()}</Td>
                    <Td>{branchMap[sale.branch_id] || `Branch ${sale.branch_id}`}</Td>
                    <Td>{ghs(sale.subtotal)}</Td>
                    <Td>{ghs(sale.discount_amount)}</Td>
                    <Td fontWeight="600">{ghs(sale.total_amount)}</Td>
                    <Td>
                      <Badge variant="outline">{(sale as any).payment_method || 'cash'}</Badge>
                    </Td>
                    <Td>
                      <Badge colorScheme="green">Completed</Badge>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Box>
        <Pagination page={currentPage} totalPages={totalPages} total={sales.length} perPage={ITEMS_PER_PAGE} onChange={setCurrentPage} />
      </Card>

      <SalesReceiptModal isOpen={isReceiptOpen} onClose={() => setIsReceiptOpen(false)} sale={selectedSale} />
    </>
  )
}
