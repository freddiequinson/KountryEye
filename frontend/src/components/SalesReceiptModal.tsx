import React, { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Download, Printer, X } from "lucide-react";
import { Badge } from "./ui/badge";

interface SaleItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  discount: number;
  total: number;
  product?: {
    name: string;
    sku: string;
  };
}

interface Sale {
  id: number;
  receipt_number: string;
  branch_id: number;
  patient_id?: number;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  items: SaleItem[];
  patient?: {
    first_name: string;
    last_name: string;
    phone?: string;
  };
  branch?: {
    name: string;
  };
}

interface SalesReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
}

export const SalesReceiptModal: React.FC<SalesReceiptModalProps> = ({
  isOpen,
  onClose,
  sale,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!sale) return null;

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt - ${sale.receipt_number}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { font-size: 18px; margin: 0; }
            .header p { font-size: 12px; margin: 5px 0; color: #666; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; font-size: 12px; margin: 5px 0; }
            .item-name { flex: 1; }
            .item-qty { width: 40px; text-align: center; }
            .item-price { width: 70px; text-align: right; }
            .total-row { display: flex; justify-content: space-between; font-size: 14px; margin: 5px 0; }
            .total-row.grand { font-weight: bold; font-size: 16px; }
            .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #666; }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleDownload = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const htmlContent = `
      <html>
        <head>
          <title>Receipt - ${sale.receipt_number}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 20px; }
            .header h1 { font-size: 18px; margin: 0; }
            .header p { font-size: 12px; margin: 5px 0; color: #666; }
            .divider { border-top: 1px dashed #000; margin: 10px 0; }
            .item { display: flex; justify-content: space-between; font-size: 12px; margin: 5px 0; }
            .total-row { display: flex; justify-content: space-between; font-size: 14px; margin: 5px 0; }
            .total-row.grand { font-weight: bold; font-size: 16px; }
            .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #666; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${sale.receipt_number}.html`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) => {
    return `GH₵${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      mobile_money: 'Mobile Money',
      momo: 'Mobile Money',
      insurance: 'Insurance',
      visioncare: 'VisionCare',
    };
    return methods[method] || method;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Sales Receipt</span>
            <Badge variant="success">Completed</Badge>
          </DialogTitle>
        </DialogHeader>

        <div ref={receiptRef} className="bg-white p-4 rounded border">
          <div className="header text-center mb-4">
            <h1 className="text-lg font-bold">Kountry Eyecare</h1>
            <p className="text-sm text-muted-foreground">Your Vision, Our Priority</p>
            <p className="text-xs text-muted-foreground mt-2">
              {new Date(sale.created_at).toLocaleString()}
            </p>
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          <div className="text-sm space-y-1 mb-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Receipt #:</span>
              <span className="font-medium">{sale.receipt_number}</span>
            </div>
            {sale.patient && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer:</span>
                <span>{sale.patient.first_name} {sale.patient.last_name}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment:</span>
              <span>{formatPaymentMethod(sale.payment_method)}</span>
            </div>
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          <div className="space-y-2">
            <div className="flex text-xs font-medium text-muted-foreground">
              <span className="flex-1">Item</span>
              <span className="w-10 text-center">Qty</span>
              <span className="w-20 text-right">Amount</span>
            </div>
            {sale.items.map((item, index) => (
              <div key={item.id || index} className="flex text-sm">
                <span className="flex-1 truncate">
                  {item.product?.name || `Product #${item.product_id}`}
                </span>
                <span className="w-10 text-center">{item.quantity}</span>
                <span className="w-20 text-right">{formatCurrency(item.total)}</span>
              </div>
            ))}
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(sale.subtotal)}</span>
            </div>
            {(sale.discount_amount > 0 || sale.discount_percent > 0) && (
              <div className="flex justify-between text-red-600">
                <span>Discount {sale.discount_percent > 0 ? `(${sale.discount_percent}%)` : ''}</span>
                <span>-{formatCurrency(sale.discount_amount + (sale.subtotal * sale.discount_percent / 100))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg pt-2 border-t">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(sale.total_amount)}</span>
            </div>
          </div>

          <div className="divider border-t border-dashed border-gray-400 my-3" />

          <div className="footer text-center text-xs text-muted-foreground">
            <p>Thank you for your purchase!</p>
            <p>Please keep this receipt for your records.</p>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Button onClick={handlePrint} className="flex-1">
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button onClick={handleDownload} variant="outline" className="flex-1">
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
          <Button onClick={onClose} variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SalesReceiptModal;
