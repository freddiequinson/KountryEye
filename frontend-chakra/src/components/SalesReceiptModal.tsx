import { useRef, type CSSProperties } from 'react'
import { Badge, Box, Button, Flex, IconButton } from '@chakra-ui/react'
import { MdClose, MdDownload, MdPrint } from 'react-icons/md'
import { AppModal } from '@/components/ui'

interface SaleItem {
  id: number
  product_id: number
  quantity: number
  unit_price: number
  discount: number
  total: number
  product?: { name: string; sku: string }
}

interface Sale {
  id: number
  receipt_number: string
  branch_id: number
  patient_id?: number
  subtotal: number
  discount_amount: number
  discount_percent: number
  total_amount: number
  payment_method: string
  status: string
  created_at: string
  items: SaleItem[]
  patient?: { first_name: string; last_name: string; phone?: string }
  branch?: { name: string }
}

const formatCurrency = (amount: number) => `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatPaymentMethod = (method: string) =>
  ({ cash: 'Cash', card: 'Card', mobile_money: 'Mobile Money', momo: 'Mobile Money', insurance: 'Insurance', visioncare: 'VisionCare' })[method] || method

// The receipt body uses plain elements with inline styles so its innerHTML prints/downloads identically outside the app.
const s = {
  muted: { color: '#666' },
  divider: { borderTop: '1px dashed #999', margin: '12px 0' },
  row: { display: 'flex', justifyContent: 'space-between', fontSize: 13, margin: '4px 0' },
} satisfies Record<string, CSSProperties>

const receiptDocument = (title: string, body: string) => `
  <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; color: #000; }
        @media print { body { padding: 0; } }
      </style>
    </head>
    <body>${body}</body>
  </html>`

export function SalesReceiptModal({ isOpen, onClose, sale }: { isOpen: boolean; onClose: () => void; sale: Sale | null }) {
  const receiptRef = useRef<HTMLDivElement>(null)

  if (!sale) return null

  const html = () => receiptDocument(`Receipt - ${sale.receipt_number}`, receiptRef.current?.innerHTML || '')

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(html())
    printWindow.document.close()
    printWindow.print()
  }

  const handleDownload = () => {
    const url = window.URL.createObjectURL(new Blob([html()], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `receipt-${sale.receipt_number}.html`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const discount = sale.discount_amount + (sale.subtotal * sale.discount_percent) / 100

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <Flex align="center" gap="12px">
          Sales Receipt
          <Badge colorScheme="green">Completed</Badge>
        </Flex>
      }
    >
      <Box bg="white" color="black" p="16px" borderRadius="12px" border="1px solid" borderColor="gray.200">
        <div ref={receiptRef}>
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Kountry Eyecare</h1>
            <p style={{ ...s.muted, fontSize: 13, margin: '4px 0' }}>Your Vision, Our Priority</p>
            <p style={{ ...s.muted, fontSize: 11, marginTop: 8 }}>{new Date(sale.created_at).toLocaleString()}</p>
          </div>

          <div style={s.divider} />

          <div style={s.row}>
            <span style={s.muted}>Receipt #:</span>
            <span style={{ fontWeight: 600 }}>{sale.receipt_number}</span>
          </div>
          {sale.patient && (
            <div style={s.row}>
              <span style={s.muted}>Customer:</span>
              <span>
                {sale.patient.first_name} {sale.patient.last_name}
              </span>
            </div>
          )}
          <div style={s.row}>
            <span style={s.muted}>Payment:</span>
            <span>{formatPaymentMethod(sale.payment_method)}</span>
          </div>

          <div style={s.divider} />

          <div style={{ ...s.row, ...s.muted, fontSize: 11, fontWeight: 600 }}>
            <span style={{ flex: 1 }}>Item</span>
            <span style={{ width: 40, textAlign: 'center' }}>Qty</span>
            <span style={{ width: 80, textAlign: 'right' }}>Amount</span>
          </div>
          {sale.items.map((item, index) => (
            <div key={item.id || index} style={s.row}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.product?.name || `Product #${item.product_id}`}
              </span>
              <span style={{ width: 40, textAlign: 'center' }}>{item.quantity}</span>
              <span style={{ width: 80, textAlign: 'right' }}>{formatCurrency(item.total)}</span>
            </div>
          ))}

          <div style={s.divider} />

          <div style={s.row}>
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal)}</span>
          </div>
          {(sale.discount_amount > 0 || sale.discount_percent > 0) && (
            <div style={{ ...s.row, color: '#E31A1A' }}>
              <span>Discount {sale.discount_percent > 0 ? `(${sale.discount_percent}%)` : ''}</span>
              <span>-{formatCurrency(discount)}</span>
            </div>
          )}
          <div style={{ ...s.row, fontWeight: 700, fontSize: 17, paddingTop: 8, borderTop: '1px solid #ddd' }}>
            <span>Total</span>
            <span style={{ color: '#4C9B4F' }}>{formatCurrency(sale.total_amount)}</span>
          </div>

          <div style={s.divider} />

          <div style={{ ...s.muted, textAlign: 'center', fontSize: 11 }}>
            <p style={{ margin: 0 }}>Thank you for your purchase!</p>
            <p style={{ margin: 0 }}>Please keep this receipt for your records.</p>
          </div>
        </div>
      </Box>

      <Flex gap="8px" mt="16px">
        <Button variant="brand" flex="1" leftIcon={<MdPrint />} onClick={handlePrint}>
          Print
        </Button>
        <Button variant="light" flex="1" leftIcon={<MdDownload />} onClick={handleDownload}>
          Download
        </Button>
        <IconButton aria-label="Close" variant="ghost" icon={<MdClose />} onClick={onClose} />
      </Flex>
    </AppModal>
  )
}

export default SalesReceiptModal
