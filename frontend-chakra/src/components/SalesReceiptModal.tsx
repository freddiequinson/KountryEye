import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Badge, Box, Button, Flex, IconButton } from '@chakra-ui/react'
import { MdClose, MdDownload, MdEmail, MdPhone, MdPrint } from 'react-icons/md'
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
  cashier_name?: string
  branch_id: number
  patient_id?: number
  subtotal: number
  discount_amount: number
  discount_percent: number
  tax_amount?: number
  total_amount: number
  payment_method: string
  status: string
  created_at: string
  items: SaleItem[]
  patient?: { first_name: string; last_name: string; phone?: string }
  branch?: { name: string; address?: string }
}

const formatCurrency = (amount: number) => `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatPaymentMethod = (method: string) =>
  ({ cash: 'Cash', card: 'Card', mobile_money: 'Mobile Money', momo: 'Mobile Money', insurance: 'Insurance', visioncare: 'VisionCare' })[method] || method

const COMPANY = { phone: '+233 54 848 1866', email: 'kountryeyecare@gmail.com' }

// The receipt is an A5 page built from plain elements with inline styles, so its innerHTML prints/downloads identically outside the app.
const c = { dark: '#14472A', green: '#3E8141', tint: '#DCEEDD', ink: '#16241A', muted: '#5F6F64' }
const gradient = `linear-gradient(100deg, ${c.dark} 0%, ${c.green} 100%)`
const columns = '1fr 25mm 12mm 27mm'
const rule = `1.5px solid ${c.green}`

const s = {
  page: {
    width: '148mm',
    minHeight: '210mm',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden',
    background: '#fff',
    color: c.ink,
    fontFamily: "'Plus Jakarta Sans', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 11,
    lineHeight: 1.4,
  },
  label: { color: c.dark, fontWeight: 800, fontSize: 10, letterSpacing: '0.04em', textTransform: 'uppercase' },
  pill: { height: '5mm', borderRadius: '999px 0 0 999px', background: `linear-gradient(90deg, ${c.tint}, rgba(220, 238, 221, 0))` },
  head: { display: 'grid', gridTemplateColumns: columns, padding: '2.6mm 5mm', borderRadius: 999, background: gradient, color: '#fff', fontWeight: 800, fontSize: 10, letterSpacing: '0.04em' },
  row: { display: 'grid', gridTemplateColumns: columns, padding: '0 5mm' },
  cell: { padding: '3mm 0' },
  totalCell: { padding: '3mm 0 3mm 4mm', borderLeft: rule },
  sum: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '1.6mm 0' },
  chip: { width: '6mm', height: '6mm', borderRadius: '50%', background: '#fff', color: c.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
} satisfies Record<string, CSSProperties>

const receiptDocument = (title: string, body: string) => `
  <html>
    <head>
      <title>${title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>
        @page { size: A5; margin: 0; }
        html, body { margin: 0; }
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        @media screen { body { background: #EEF1EE; display: flex; justify-content: center; padding: 20px 0; } }
      </style>
    </head>
    <body>${body}</body>
  </html>`

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '3mm' }}>
      <span style={{ ...s.label, paddingTop: 1 }}>{label}</span>
      <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{children}</div>
    </div>
  )
}

export function SalesReceiptModal({ isOpen, onClose, sale }: { isOpen: boolean; onClose: () => void; sale: Sale | null }) {
  const receiptRef = useRef<HTMLDivElement>(null)
  // The logo is inlined as a data URL so it survives in the printed window and the downloaded file.
  const [logo, setLogo] = useState('/kountry-logo.png')

  useEffect(() => {
    let cancelled = false
    fetch('/kountry-logo.png')
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader()
        reader.onload = () => !cancelled && typeof reader.result === 'string' && setLogo(reader.result)
        reader.readAsDataURL(blob)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!sale) return null

  const html = () => receiptDocument(`Receipt - ${sale.receipt_number}`, receiptRef.current?.innerHTML || '')

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    printWindow.document.write(html())
    // Wait for the font before printing.
    printWindow.onload = () => printWindow.print()
    printWindow.document.close()
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
  // Item prices and the subtotal are base prices; VAT was added on top of the discounted amount.
  const vat = sale.tax_amount || 0
  const vatRate = sale.total_amount - vat > 0 ? Math.round((vat / (sale.total_amount - vat)) * 10000) / 100 : 0
  const soldAt = new Date(sale.created_at)

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      title={
        <Flex align="center" gap="12px">
          Sales Receipt
          <Badge colorScheme="green">Completed</Badge>
        </Flex>
      }
    >
      <Box overflowX="auto" bg="secondaryGray.300" _dark={{ bg: 'whiteAlpha.100' }} borderRadius="12px" p="12px">
        <Box ref={receiptRef} w="fit-content" mx="auto" boxShadow="card">
          <div style={s.page}>
            <div style={{ display: 'flex' }}>
              <div style={{ width: '66%', boxSizing: 'border-box', background: gradient, borderBottomRightRadius: '24mm', padding: '9mm 10mm' }}>
                <div style={{ display: 'inline-block', background: '#fff', borderRadius: '3mm', padding: '2mm 3.5mm' }}>
                  <img src={logo} alt="Kountry Eyecare" style={{ display: 'block', height: '13mm' }} />
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4.5mm', paddingTop: '7mm' }}>
                <div style={{ ...s.pill, width: '74%' }} />
                <div style={{ ...s.pill, width: '50%' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '4mm 6mm', padding: '9mm 12mm 0' }}>
              <Meta label="Receipt">
                N° {sale.receipt_number}
                {sale.branch && <div style={{ color: c.muted }}>{[sale.branch.name, sale.branch.address].filter(Boolean).join(', ')}</div>}
              </Meta>
              <Meta label="Date">
                {soldAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                <div style={{ color: c.muted }}>{soldAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
              </Meta>
              <Meta label="Customer">
                {sale.patient ? `${sale.patient.first_name} ${sale.patient.last_name}` : 'Walk-in customer'}
                {sale.patient?.phone && <div style={{ color: c.muted }}>{sale.patient.phone}</div>}
              </Meta>
            </div>

            <div style={{ margin: '8mm 10mm 0' }}>
              <div style={s.head}>
                <span>PRODUCT</span>
                <span style={{ textAlign: 'right' }}>PRICE</span>
                <span style={{ textAlign: 'center' }}>QTY</span>
                <span style={{ paddingLeft: '4mm' }}>TOTAL</span>
              </div>
              {sale.items.map((item, index) => (
                <div key={item.id || index} style={{ ...s.row, borderBottom: index < sale.items.length - 1 ? rule : undefined }}>
                  <span style={{ ...s.cell, fontWeight: 700, paddingRight: '3mm', overflowWrap: 'anywhere' }}>{item.product?.name || `Product #${item.product_id}`}</span>
                  <span style={{ ...s.cell, textAlign: 'right' }}>{formatCurrency(item.unit_price)}</span>
                  <span style={{ ...s.cell, textAlign: 'center' }}>{item.quantity}</span>
                  <span style={s.totalCell}>{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8mm', padding: '7mm 12mm 0' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={s.label}>Payment method</div>
                <div style={{ marginTop: '1.5mm' }}>{formatPaymentMethod(sale.payment_method)}</div>
                <div style={{ color: c.muted, fontSize: 9.5, marginTop: '5mm' }}>
                  Thank you for choosing Kountry Eyecare. Please keep this receipt for your records.
                </div>
              </div>
              <div style={{ width: '56mm', flexShrink: 0 }}>
                <div style={s.sum}>
                  <span style={{ ...s.label, fontSize: 12 }}>Sub total</span>
                  <span>{formatCurrency(sale.subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div style={s.sum}>
                    <span style={{ ...s.label, fontSize: 12 }}>Discount{sale.discount_percent > 0 ? ` (${sale.discount_percent}%)` : ''}</span>
                    <span>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div style={s.sum}>
                  <span style={{ ...s.label, fontSize: 12 }}>VAT ({vatRate}%)</span>
                  <span>{formatCurrency(vat)}</span>
                </div>
                <div style={{ ...s.sum, borderTop: rule, marginTop: '3mm', paddingTop: '3mm' }}>
                  <span style={{ ...s.label, fontSize: 13 }}>Total</span>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{formatCurrency(sale.total_amount)}</span>
                </div>
                {/* Signed with the account that made the sale, for auditing */}
                <div style={{ marginTop: '11mm', textAlign: 'center' }}>
                  <div style={{ fontStyle: 'italic', fontSize: 12, minHeight: '5mm' }}>{sale.cashier_name}</div>
                  <div style={{ borderTop: `1px solid ${c.ink}`, width: '40mm', margin: '1mm auto 1.5mm' }} />
                  <span style={{ ...s.label, fontSize: 9 }}>Authorised sign</span>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, minHeight: '10mm' }} />

            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '2mm 8mm', margin: '0 7mm', padding: '4mm 8mm', borderRadius: '11mm 11mm 0 0', background: gradient, color: '#fff', fontSize: 10.5 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2mm' }}>
                <span style={s.chip}>
                  <MdPhone size={12} />
                </span>
                {COMPANY.phone}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2mm' }}>
                <span style={s.chip}>
                  <MdEmail size={12} />
                </span>
                {COMPANY.email}
              </span>
            </div>
          </div>
        </Box>
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
