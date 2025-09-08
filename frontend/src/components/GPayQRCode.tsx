import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, CheckCircle } from 'lucide-react';

interface GPayQRCodeProps {
  billId: string;
  shopId: number;
  shopName: string;
  amount: number;
  upiId: string;
  onClose: () => void;
  onPaymentSuccess: (transactionId: string, paidAmount: number) => void;
}

const GPayQRCode: React.FC<GPayQRCodeProps> = ({
  billId,
  shopId,
  shopName,
  amount: initialAmount,
  upiId,
  onClose,
  onPaymentSuccess
}) => {
  const [copied, setCopied] = React.useState(false);
  const [paymentStatus, setPaymentStatus] = React.useState<'pending' | 'success' | 'failed'>('pending');
  const [transactionId, setTransactionId] = React.useState('');
  const [amount, setAmount] = React.useState<number>(initialAmount);

  // Generate UPI payment URL (reactive to amount changes)
  const upiUrl = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${amount}&cu=INR&tn=Bill ${billId}`;

  const copyUpiUrl = () => {
    navigator.clipboard.writeText(upiUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateTransactionId = () => {
    return `TXN${Date.now()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  };

  const handlePaymentSuccess = () => {
    const txId = generateTransactionId();
    setTransactionId(txId);
    setPaymentStatus('success');
    setTimeout(() => {
      onPaymentSuccess(txId, amount);
      onClose();
    }, 2000);
  };

  const handlePaymentFailure = () => {
    setPaymentStatus('failed');
    setTimeout(() => {
      setPaymentStatus('pending');
    }, 3000);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-lg bg-white">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Pay with GPay</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {paymentStatus === 'pending' && (
          <>
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 mb-2">Scan the QR code with Google Pay or any UPI app</p>
              
              {/* Amount Input Field */}
              <div className="mb-3">
                <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount
                </label>
                <input
                  type="number"
                  id="paymentAmount"
                  min="0"
                  max={initialAmount}
                  value={amount}
                  onChange={(e) => setAmount(Math.max(0, Math.min(initialAmount, parseFloat(e.target.value) || 0)))}
                  className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-semibold text-green-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Max: ₹{initialAmount.toLocaleString()}
                </p>
              </div>
              
              <p className="text-sm text-gray-500">Bill: {billId}</p>
              <p className="text-sm text-gray-500">Shop: {shopName}</p>
            </div>

            <div className="flex justify-center mb-4">
              <QRCodeSVG
                value={upiUrl}
                size={200}
                level="H"
                includeMargin
              />
            </div>

            <div className="bg-gray-50 p-3 rounded-lg mb-4">
              <p className="text-sm text-gray-600 mb-1">UPI ID: {upiId}</p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 truncate mr-2">{upiUrl}</p>
                <button
                  onClick={copyUpiUrl}
                  className="flex items-center text-blue-600 hover:text-blue-800 text-sm"
                >
                  {copied ? (
                    <CheckCircle className="h-4 w-4 mr-1" />
                  ) : (
                    <Copy className="h-4 w-4 mr-1" />
                  )}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex justify-center space-x-3 mb-4">
              <button
                onClick={handlePaymentSuccess}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm"
              >
                Payment Successful
              </button>
              <button
                onClick={handlePaymentFailure}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg text-sm"
              >
                Payment Failed
              </button>
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                Click the appropriate button above to simulate payment status
              </p>
            </div>
          </>
        )}

        {paymentStatus === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-green-600 mb-2">Payment Successful!</h4>
            <p className="text-sm text-gray-600">Transaction ID: {transactionId}</p>
            <p className="text-sm text-gray-600">Amount: ₹{amount.toLocaleString()}</p>
          </div>
        )}

        {paymentStatus === 'failed' && (
          <div className="text-center py-8">
            <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-red-600 mb-2">Payment Failed</h4>
            <p className="text-sm text-gray-600">Please try again or use another payment method</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GPayQRCode;
