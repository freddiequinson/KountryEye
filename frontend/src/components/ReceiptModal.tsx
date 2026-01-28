import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Download } from "lucide-react";

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiptUrl: string;
  receiptNumber?: string;
  patientName?: string;
  totalAmount?: number;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  receiptUrl,
  receiptNumber,
  patientName,
  totalAmount,
}) => {
  const handleDownload = () => {
    window.open(receiptUrl, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-center py-4">
            <div className="text-green-600 mb-2">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold mb-2">Payment Successful!</h3>
            
            {receiptNumber && (
              <p className="text-sm text-muted-foreground mb-1">
                Receipt: {receiptNumber}
              </p>
            )}
            
            {patientName && (
              <p className="text-sm text-muted-foreground mb-1">
                Patient: {patientName}
              </p>
            )}
            
            {totalAmount !== undefined && (
              <p className="text-2xl font-bold text-green-600">
                GHS {totalAmount.toFixed(2)}
              </p>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download Receipt
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
