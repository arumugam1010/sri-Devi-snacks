import React, { useState } from 'react';
import { Search, Plus, Trash2, Receipt, RotateCcw, Calculator, ShoppingCart, Eye, CreditCard } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import GPayQRCode from './GPayQRCode';

interface BillItem {
  id: number;
  product_id: number;
  product_name: string;
  price: number;
  quantity: number;
  amount: number;
  unit: string;
  return_quantity?: number;
  gst?: number;
  sgst?: number;
  cgst?: number;
  hsn_code: string;
}

interface Bill {
  id: string;
  shop_id: number;
  shop_name: string;
  bill_date: string;
  total_amount: number;
  received_amount: number;
  pending_amount: number;
  status: 'pending' | 'completed';
  items: BillItem[];
  payment_mode?: string;
  transaction_id?: string;
  payment_date?: string;
}

interface ReturnItem extends BillItem {
  return_quantity: number;
  return_amount: number;
  bill_id: string;
}

const Billing: React.FC = () => {
  const { products, addBill, shopProducts } = useAppContext();
  
  // Mock data
  const { weeklySchedule } = useAppContext();

  // State for selected day to filter shops
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  // Shops filtered by selected day with GST numbers
  const shops = React.useMemo(() => {
    if (!selectedDay) return [];
    const daySchedule = weeklySchedule.find(day => day.day === selectedDay);
    return daySchedule ? daySchedule.shops.map(shop => ({
      ...shop,
      gst: shop.id === 1 ? '33BBBBB5678B2Y6' :
           shop.id === 2 ? '33CCCCC9012C3Z7' :
           shop.id === 3 ? '33DDDDD3456D4A8' : undefined
    })) : [];
  }, [selectedDay, weeklySchedule]);

  // Days of week for dropdown
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];



  const [selectedShop, setSelectedShop] = useState<number | null>(null);
  const [currentBill, setCurrentBill] = useState<BillItem[]>([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  // Removed local savedBills state to use context bills instead
  // const [savedBills, setSavedBills] = useState<Bill[]>([]);
  const { bills, setBills } = useAppContext();
  const [returnQuantities, setReturnQuantities] = useState<{[key: number]: number}>({});
  const [selectedBillForView, setSelectedBillForView] = useState<Bill | null>(null);
  const [showBillingInterface, setShowBillingInterface] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState<string>("");
  const [showPendingBillAlert, setShowPendingBillAlert] = useState(false);
  const [pendingBills, setPendingBills] = useState<Bill[]>([]);
  const [isPayPendingMode, setIsPayPendingMode] = useState(false);
  const [pendingPaymentAmount, setPendingPaymentAmount] = useState<number>(0);
  const [showGPayQR, setShowGPayQR] = useState(false);
  const [currentBillForPayment, setCurrentBillForPayment] = useState<Bill | null>(null);
  const [hasPrinted, setHasPrinted] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<{financialYear: string; monthName: string} | null>(null);

  // Previous bills for returns (mock data)
  const [previousBills] = useState<Bill[]>([
    {
      id: 'B001',
      shop_id: 1,
      shop_name: 'Metro Store',
      bill_date: '2024-01-15',
      total_amount: 1250,
      received_amount: 1000,
      pending_amount: 250,
      status: 'pending',
      items: [
        { id: 1, product_id: 1, product_name: 'Rice Basmati', price: 120, quantity: 5, amount: 600, unit: 'kg', hsn_code: '10063010' },
        { id: 2, product_id: 2, product_name: 'Wheat Flour', price: 45, quantity: 10, amount: 450, unit: 'kg', hsn_code: '11010000' },
        { id: 3, product_id: 3, product_name: 'Sugar', price: 55, quantity: 4, amount: 200, unit: 'kg', hsn_code: '17019990' }
      ]
    }
  ]);

  const [productForm, setProductForm] = useState({
    product_id: '',
    quantity: 1
  });

  // Get all products for the selected shop, or all products if none are priced for the shop
  const selectedShopProducts = selectedShop
    ? shopProducts.filter(sp => sp.shop_id === selectedShop)
    : [];

  // Get all available products for dropdown (only products with stock > 0)
  const allProductsForShop = selectedShop
    ? products
        .filter(product => product.quantity > 0) // Only show products with stock
        .map(product => {
          const shopPricing = shopProducts.find(sp =>
            sp.shop_id === selectedShop && sp.product_id === product.id
          );
          return {
            id: Date.now() + product.id, // temporary ID
            shop_id: selectedShop,
            product_id: product.id,
            product_name: product.product_name,
            price: shopPricing ? shopPricing.price : product.price, // Use shop-specific price if available, otherwise use product price
            unit: product.unit,
            gst: product.gst, // inherit gst from base product
            stock_quantity: product.quantity, // include stock quantity
            hsn_code: product.hsn_code // inherit hsn_code from base product
          };
        })
    : [];
  const currentShop = shops.find(shop => shop.id === selectedShop);
  const totalAmount = currentBill.reduce((sum, item) => sum + item.amount, 0);

  const handleDaySelect = (day: string | null) => {
    setSelectedDay(day);
    setSelectedShop(null); // Reset shop selection when day changes
    setCurrentBill([]); // Clear current bill when day changes
    setPendingBills([]);
    setIsPayPendingMode(false);
    setPendingPaymentAmount(0);
    setProductForm({ product_id: '', quantity: 1 });
  };

  const handleShopSelect = (shopId: number | null) => {
    if (currentBill.length > 0 && shopId !== null) {
        alert('You cannot change the shop while there are items in the current bill.');
        return;
    }
    if (shopId === null) {
      setSelectedShop(null);
      setProductForm({ product_id: '', quantity: 1 });
      setPendingBills([]);
      setIsPayPendingMode(false);
      setPendingPaymentAmount(0);
      return;
    }
    
    if (currentBill.length > 0) {
      if (confirm('Changing shop will clear current bill. Continue?')) {
        setCurrentBill([]);
        setSelectedShop(shopId);
      }
    } else {
      setSelectedShop(shopId);
    }
    
    // Check for pending bills for this shop
    const shopPendingBills = bills.filter(bill => 
      bill.shop_id === shopId && bill.status === 'pending'
    );
    
    if (shopPendingBills.length > 0) {
      // Sort pending bills by date (oldest first for payment allocation)
      const sortedPendingBills = [...shopPendingBills].sort((a, b) => 
        new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime()
      );
      setPendingBills(sortedPendingBills);
      setShowPendingBillAlert(true);
      // Reset payment mode when selecting a new shop
      setIsPayPendingMode(false);
      setPendingPaymentAmount(0);
    } else {
      setPendingBills([]);
      setShowPendingBillAlert(false);
      setIsPayPendingMode(false);
    }
    
    setProductForm({ product_id: '', quantity: 1 });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    
    const productId = parseInt(productForm.product_id);
    const product = allProductsForShop.find(p => p.product_id === productId);
    
    if (!product) return;
    
    // Check if product has a price set
    if (product.price === 0) {
      alert('Please set a price for this product before adding it to the bill.');
      return;
    }

    // Check stock availability
    const baseProduct = products.find(p => p.id === product.product_id);
    if (!baseProduct) return;
    
    const totalRequestedQuantity = productForm.quantity + 
      (currentBill.find(item => item.product_id === product.product_id)?.quantity || 0);
    
    if (totalRequestedQuantity > baseProduct.quantity) {
      alert(`Not enough stock available! Available: ${baseProduct.quantity}, Requested: ${totalRequestedQuantity}`);
      return;
    }

    const existingItemIndex = currentBill.findIndex(item => item.product_id === product.product_id);
    
    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedBill = [...currentBill];
      updatedBill[existingItemIndex].quantity += productForm.quantity;
      updatedBill[existingItemIndex].amount = updatedBill[existingItemIndex].quantity * updatedBill[existingItemIndex].price;
      // Recalculate SGST and CGST
      if (product.gst) {
        const gstAmount = (updatedBill[existingItemIndex].amount * product.gst) / 100;
        updatedBill[existingItemIndex].sgst = gstAmount / 2;
        updatedBill[existingItemIndex].cgst = gstAmount / 2;
      }
      setCurrentBill(updatedBill);
    } else {
      // Add new item
      const amount = product.price * productForm.quantity;
      const newItem: BillItem = {
        id: Date.now(),
        product_id: product.product_id,
        product_name: product.product_name,
        price: product.price,
        quantity: productForm.quantity,
        amount: amount,
        unit: product.unit,
        hsn_code: product.hsn_code
      };
      
      // Calculate SGST and CGST
      if (product.gst) {
        const gstAmount = (amount * product.gst) / 100;
        newItem.sgst = gstAmount / 2;
        newItem.cgst = gstAmount / 2;
      }
      
      setCurrentBill([...currentBill, newItem]);
      setHasPrinted(false); // Reset print status when items are added
    }

    setProductForm({ product_id: '', quantity: 1 });
  };

  const handleRemoveItem = (itemId: number) => {
    setCurrentBill(currentBill.filter(item => item.id !== itemId));
    setHasPrinted(false); // Reset print status when items are modified
  };

  const handleQuantityChange = (itemId: number, quantity: number) => {
    if (quantity <= 0) return;

    setCurrentBill(currentBill.map(item =>
      item.id === itemId
        ? { ...item, quantity, amount: item.price * quantity }
        : item
    ));
    setHasPrinted(false); // Reset print status when quantities are changed
  };

  const handlePayPending = () => {
    if (pendingBills.length === 0 || !selectedShop || pendingPaymentAmount <= 0) {
      return; // No validation messages, just silently return
    }

    let remainingPayment = pendingPaymentAmount;
    const updatedBills = [...bills];
    const updatedPendingBills = [...pendingBills];

    // Apply payment to bills in order (oldest first)
    for (let i = 0; i < updatedPendingBills.length && remainingPayment > 0; i++) {
      const bill = updatedPendingBills[i];
      const paymentAmount = Math.min(remainingPayment, bill.pending_amount);
      const remainingAmount = bill.pending_amount - paymentAmount;
      
      // Update the bill in the main bills array
      const billIndex = updatedBills.findIndex(b => b.id === bill.id);
      if (billIndex !== -1) {
        updatedBills[billIndex] = {
          ...bill,
          received_amount: bill.received_amount + paymentAmount,
          pending_amount: remainingAmount,
          status: remainingAmount === 0 ? 'completed' : 'pending'
        };
      }
      
      // Update the pending bill in our local state
      updatedPendingBills[i] = {
        ...bill,
        received_amount: bill.received_amount + paymentAmount,
        pending_amount: remainingAmount,
        status: remainingAmount === 0 ? 'completed' : 'pending'
      };
      
      remainingPayment -= paymentAmount;
    }

    setBills(updatedBills);
    
    // Update pending bills state, filtering out completed bills
    const newPendingBills = updatedPendingBills.filter(bill => bill.pending_amount > 0);
    setPendingBills(newPendingBills);
    
    // Reset payment amount but keep the mode
    setPendingPaymentAmount(0);
    
    // Show success message
    const totalPaid = pendingPaymentAmount - remainingPayment;
    if (totalPaid > 0) {
      alert(`Payment of ₹${totalPaid} applied to pending bills. Remaining balance: ₹${newPendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}`);
    }
  };

  const handleSaveBill = () => {
    if (!selectedShop) {
      alert('Please select a shop first');
      return;
    }

    // If no items in bill but there are pending bills and received amount > 0
    if (currentBill.length === 0 && pendingBills.length > 0 && parseFloat(receivedAmount || "0") > 0) {
      let remainingPayment = parseFloat(receivedAmount || "0");
      const updatedBills = [...bills];
      const updatedPendingBills = [...pendingBills];

      // Apply payment to bills in order (oldest first)
      for (let i = 0; i < updatedPendingBills.length && remainingPayment > 0; i++) {
        const bill = updatedPendingBills[i];
        const paymentAmount = Math.min(remainingPayment, bill.pending_amount);
        const remainingAmount = bill.pending_amount - paymentAmount;
        
        // Update the bill in the main bills array
        const billIndex = updatedBills.findIndex(b => b.id === bill.id);
        if (billIndex !== -1) {
          updatedBills[billIndex] = {
            ...bill,
            received_amount: bill.received_amount + paymentAmount,
            pending_amount: remainingAmount,
            status: remainingAmount === 0 ? 'completed' : 'pending'
          };
        }
        
        // Update the pending bill in our local state
        updatedPendingBills[i] = {
          ...bill,
          received_amount: bill.received_amount + paymentAmount,
          pending_amount: remainingAmount,
          status: remainingAmount === 0 ? 'completed' : 'pending'
        };
        
        remainingPayment -= paymentAmount;
      }

      setBills(updatedBills);

      // Update pending bills state, filtering out completed bills
      const newPendingBills = updatedPendingBills.filter(bill => bill.pending_amount > 0);
      setPendingBills(newPendingBills);

    setReceivedAmount("0");
      
      const totalPaid = parseFloat(receivedAmount) - remainingPayment;
      const remainingBalance = newPendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0);
      alert(`Payment of ₹${totalPaid} applied to pending bills. Remaining balance: ₹${remainingBalance}`);
      return;
    }

    if (currentBill.length === 0) {
      alert('Please add items to the bill or enter a payment amount for pending balance');
      return;
    }

    // Calculate final total including returns and taxes
    const returnAmount = currentBill
      .filter(item => item.quantity < 0)
      .reduce((sum, item) => sum + item.amount + (item.sgst || 0) + (item.cgst || 0), 0);
    
    const billingAmount = currentBill
      .filter(item => item.quantity > 0)
      .reduce((sum, item) => sum + item.amount + (item.sgst || 0) + (item.cgst || 0), 0);
    
    let finalTotal = billingAmount + returnAmount; // returnAmount is negative

    // Add total pending amount from all pending bills
    const totalPendingAmount = pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0);
    finalTotal += totalPendingAmount;

    // Calculate pending amount including taxes
    const pendingAmount = Math.max(0, finalTotal - parseFloat(receivedAmount || "0"));
    const billStatus = pendingAmount > 0 ? 'pending' : 'completed';

    // Generate bill ID based on financial year
    const billDate = new Date();
    const billYear = billDate.getFullYear();
    const billMonth = billDate.getMonth() + 1;
    
    // Determine financial year (April to March)
    const financialYear = billMonth >= 4 ? `${billYear}-${billYear + 1}` : `${billYear - 1}-${billYear}`;
    
    // Count bills in the current financial year
    const billsInFinancialYear = bills.filter(bill => {
      const billFinancialYear = getFinancialYear(bill.bill_date);
      return billFinancialYear === financialYear;
    });
    
    const nextBillNumber = billsInFinancialYear.length + 1;
    
    const newBill: Bill = {
      id: `B${String(nextBillNumber).padStart(3, '0')}`,
      shop_id: selectedShop,
      shop_name: currentShop?.shop_name || '',
      bill_date: new Date().toISOString(),
      total_amount: finalTotal,
      received_amount: parseFloat(receivedAmount || "0"),
      pending_amount: pendingAmount,
      status: billStatus,
      items: currentBill.map(item => ({
        ...item,
        rate: item.price
      }))
    };

    // Mark all pending bills as completed since they're being paid through this bill
    let updatedBills = [...bills];
    if (pendingBills.length > 0) {
      updatedBills = bills.map(bill => {
        const pendingBill = pendingBills.find(pb => pb.id === bill.id);
        return pendingBill 
          ? { ...bill, status: 'completed', pending_amount: 0 }
          : bill;
      });
    }

    // Use the context's addBill method which automatically handles stock updates
    addBill(newBill);
    setCurrentBill([]);
    setReturnItems([]);
    setReceivedAmount("0");
    setPendingBills([]);
    setShowPendingBillAlert(false);
    setSelectedShop(null);
    setReturnQuantities({});
    setShowBillingInterface(false);
    setIsPayPendingMode(false);
    setPendingPaymentAmount(0);
    setHasPrinted(false); // Reset print status when bill is saved
    alert(`Bill ${newBill.id} saved successfully!\nFinal Amount: ₹${finalTotal}\nStatus: ${billStatus}\nStock updated for sold items.`);
  };

  const handleShowReturns = () => {
    if (!selectedShop) {
      alert('Please select a shop first');
      return;
    }

    // Initialize return quantities for all products
    const initialReturnQuantities: {[key: number]: number} = {};
    allProductsForShop.forEach(product => {
      initialReturnQuantities[product.product_id] = 0;
    });
    setReturnQuantities(initialReturnQuantities);
    setShowReturnModal(true);
  };

  const handleReturnQuantityChange = (productId: number, returnQuantity: number) => {
    setReturnQuantities({
      ...returnQuantities,
      [productId]: returnQuantity
    });
  };

  const handleProcessReturns = () => {
    // Get products with return quantities greater than 0
    const productsToReturn = Object.entries(returnQuantities)
      .filter(([_, quantity]) => quantity > 0)
      .map(([productId, quantity]) => {
        const product = allProductsForShop.find(p => p.product_id === parseInt(productId));
        return {
          product,
          quantity: quantity as number
        };
      });
    
    if (productsToReturn.length === 0) {
        alert('Please select items to return');
        return;
    }

    // Process returns by updating the current bill
    let updatedBill = [...currentBill];
    
    productsToReturn.forEach(({ product, quantity }) => {
      if (!product) return;
      
      // Check if return item already exists in the bill
      const existingReturnItemIndex = updatedBill.findIndex(item => 
        item.product_id === product.product_id && item.quantity < 0
      );
      
      if (existingReturnItemIndex >= 0) {
        // If return item already exists, increase its negative quantity
        const existingReturnItem = updatedBill[existingReturnItemIndex];
        const newQuantity = existingReturnItem.quantity - quantity; // Subtract to make more negative
        const newAmount = newQuantity * product.price;
        updatedBill[existingReturnItemIndex] = {
          ...existingReturnItem,
          quantity: newQuantity,
          amount: newAmount
        };
        
        // Calculate SGST and CGST for return item
        if (product.gst) {
          const gstAmount = (Math.abs(newAmount) * product.gst) / 100;
          updatedBill[existingReturnItemIndex].sgst = -(gstAmount / 2);
          updatedBill[existingReturnItemIndex].cgst = -(gstAmount / 2);
        }
      } else {
        // Add return item with negative values
        const amount = -quantity * product.price; // Negative amount for return items
        const returnItem: BillItem = {
          id: Date.now() + product.product_id + Math.random(),
          product_id: product.product_id,
          product_name: product.product_name,
          price: product.price,
          quantity: -quantity, // Negative quantity for return items
          amount: amount,
          unit: product.unit,
          hsn_code: product.hsn_code
        };
        
        // Calculate SGST and CGST for return item
        if (product.gst) {
          const gstAmount = (Math.abs(amount) * product.gst) / 100;
          returnItem.sgst = -(gstAmount / 2);
          returnItem.cgst = -(gstAmount / 2);
        }
        
        updatedBill.push(returnItem);
      }
    });

    setCurrentBill(updatedBill);
    alert('Return processed successfully!');
    
    setShowReturnModal(false);
    setReturnQuantities({});
  };

  const handleGPayPayment = () => {
    if (!selectedShop) {
      alert('Please select a shop first');
      return;
    }

    // Calculate final total including returns and taxes
    const returnAmount = currentBill
      .filter(item => item.quantity < 0)
      .reduce((sum, item) => sum + item.amount + (item.sgst || 0) + (item.cgst || 0), 0);
    
    const billingAmount = currentBill
      .filter(item => item.quantity > 0)
      .reduce((sum, item) => sum + item.amount + (item.sgst || 0) + (item.cgst || 0), 0);
    
    let finalTotal = billingAmount + returnAmount; // returnAmount is negative

    // Add total pending amount from all pending bills
    const totalPendingAmount = pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0);
    finalTotal += totalPendingAmount;

    // Calculate pending amount including taxes
    const pendingAmount = Math.max(0, finalTotal - parseFloat(receivedAmount || "0"));

    const billForPayment: Bill = {
      id: `B${String(bills.length + 1).padStart(3, '0')}`,
      shop_id: selectedShop,
      shop_name: currentShop?.shop_name || '',
      bill_date: new Date().toISOString(),
      total_amount: finalTotal,
      received_amount: parseFloat(receivedAmount || "0"),
      pending_amount: pendingAmount,
      status: pendingAmount > 0 ? 'pending' : 'completed',
      items: [...currentBill]
    };

    setCurrentBillForPayment(billForPayment);
    setShowGPayQR(true);
  };

  const handlePaymentSuccess = (transactionId: string, paidAmount: number) => {
    if (!currentBillForPayment) return;

    // Update the existing bill with payment information
    const updatedBills = bills.map(bill => {
      if (bill.id === currentBillForPayment.id) {
        const newReceivedAmount = bill.received_amount + paidAmount;
        const newPendingAmount = Math.max(0, bill.total_amount - newReceivedAmount);
        const newStatus: 'pending' | 'completed' = newPendingAmount === 0 ? 'completed' : 'pending';
        
        return {
          ...bill,
          received_amount: newReceivedAmount,
          pending_amount: newPendingAmount,
          status: newStatus,
          payment_mode: 'GPay',
          transaction_id: transactionId,
          payment_date: new Date().toISOString().split('T')[0]
        };
      }
      return bill;
    });

    // Update the bills in context
    setBills(updatedBills);
    
    // Show success message
    const statusMessage = paidAmount >= currentBillForPayment.total_amount ? 'Paid' : 'Partially Paid';
    alert(`Payment of ₹${paidAmount} processed successfully via GPay!\nTransaction ID: ${transactionId}\nBill ${currentBillForPayment.id} updated to ${statusMessage} status.`);

    // Reset states
    setCurrentBill([]);
    setReceivedAmount("0");
    setPendingBills([]);
    setShowPendingBillAlert(false);
    setSelectedShop(null);
    setShowBillingInterface(false);
    setIsPayPendingMode(false);
    setPendingPaymentAmount(0);
    setCurrentBillForPayment(null);
  };

  // Helper function to get financial year from date
  const getFinancialYear = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // 1-12
    
    // Financial year: April to March (April = 4, March = 3)
    if (month >= 4) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  };

  // Helper function to get month name from date
  const getMonthName = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('default', { month: 'long' });
  };

  // Group bills by financial year and month
  const groupedBills = React.useMemo(() => {
    const grouped: {[key: string]: {[key: string]: Bill[]}} = {};
    
    bills.forEach(bill => {
      const financialYear = getFinancialYear(bill.bill_date);
      const monthName = getMonthName(bill.bill_date);
      
      if (!grouped[financialYear]) {
        grouped[financialYear] = {};
      }
      
      if (!grouped[financialYear][monthName]) {
        grouped[financialYear][monthName] = [];
      }
      
      grouped[financialYear][monthName].push(bill);
    });
    
    return grouped;
  }, [bills]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Billing System</h2>
          <p className="text-gray-600 mt-1">Create bills and process returns for shops</p>
        </div>
        <div className="flex space-x-3">

      {/* Create Bill Button */}
      {!showBillingInterface && (
          <button
            onClick={() => {
              setShowBillingInterface(true);
              setIsPayPendingMode(false);
              setPendingPaymentAmount(0);
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            <Receipt className="h-5 w-5 mr-2" />
            Create Bill
          </button>
       
      )}
          <button
            onClick={handleShowReturns}
            disabled={!selectedShop || isPayPendingMode}
            className="inline-flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
          >
            <RotateCcw className="h-5 w-5 mr-2" />
             Returns
          </button>
          { /* Remove Pay with GPay button here as per feedback */ }
          <button
            onClick={handleSaveBill}
            disabled={(currentBill.length > 0 && !hasPrinted) || (currentBill.length === 0 && (pendingBills.length === 0 || parseFloat(receivedAmount || "0") <= 0))}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
          >
            <Receipt className="h-5 w-5 mr-2" />
            Save Bill
          </button>
          
          
        </div>
      </div>


      {/* Saved Bills List - Month-wise Cards */}
      {!showBillingInterface && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Saved Bills</h3>
              {selectedMonth && (
                <button
                  onClick={() => setSelectedMonth(null)}
                  className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                >
                  ← Back to Months
                </button>
              )}
            </div>
          </div>
          
          {(() => {
            // Group bills by financial year and month
            const financialYearGroups: {[key: string]: {[key: string]: Bill[]}} = {};
            
            bills.forEach(bill => {
              const billDate = new Date(bill.bill_date);
              const year = billDate.getFullYear();
              const month = billDate.getMonth();
              const monthName = billDate.toLocaleString('default', { month: 'long' });
              
              // Determine financial year (April to March)
              const financialYear = billDate.getMonth() >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
              
              if (!financialYearGroups[financialYear]) {
                financialYearGroups[financialYear] = {};
              }
              
              if (!financialYearGroups[financialYear][monthName]) {
                financialYearGroups[financialYear][monthName] = [];
              }
              
              financialYearGroups[financialYear][monthName].push(bill);
            });
            
            // Sort financial years in descending order
            const sortedFinancialYears = Object.keys(financialYearGroups).sort((a, b) => {
              const [aStart] = a.split('-').map(Number);
              const [bStart] = b.split('-').map(Number);
              return bStart - aStart;
            });
            
            // If a specific month is selected, show bills for that month
            if (selectedMonth) {
              const { financialYear, monthName } = selectedMonth;
              const monthBills = financialYearGroups[financialYear]?.[monthName] || [];
              
              return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    {monthName} {financialYear}
                  </h4>
                  
                  <div className="space-y-4">
              {monthBills
                .slice()
                .sort((a, b) => {
                  // Sort by bill date (most recent first) since bill numbers reset annually
                  return new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime();
                })
                .map((bill) => (
                  <div key={bill.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{bill.id}</p>
                        <p className="text-xs text-gray-500">{bill.shop_name}</p>
                        <p className="text-xs text-gray-500">{new Date(bill.bill_date).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm">₹{bill.pending_amount}</p>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          bill.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {bill.status}
                        </span>
                      </div>
                    </div>
                    
                              <div className="flex justify-between text-xs text-gray-600 mb-3">
                                <span>Received: ₹{bill.received_amount}</span>
                                <span>Pending: ₹{bill.pending_amount}</span>
                              </div>
                    
                    <div className="flex justify-between space-x-3">
                      <button
                        onClick={() => setSelectedBillForView(bill)}
                        className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </button>
                      {bill.status !== 'completed' && (
                        <button
                          onClick={() => {
                            setCurrentBillForPayment(bill);
                            setShowGPayQR(true);
                          }}
                          className="inline-flex items-center px-3 py-1 text-sm text-purple-600 hover:text-purple-800"
                        >
                          Pay with GPay
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                    
                    {monthBills.length === 0 && (
                      <div className="text-center py-8">
                        <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-500">No bills found for {monthName} {financialYear}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            }
            
            // Show month cards overview
            return (
              <div className="space-y-8">
                {sortedFinancialYears.map(financialYear => (
                  <div key={financialYear} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Financial Year {financialYear}</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.entries(financialYearGroups[financialYear])
                        .sort(([aMonth], [bMonth]) => {
                          const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                                         'July', 'August', 'September', 'October', 'November', 'December'];
                          return months.indexOf(bMonth) - months.indexOf(aMonth);
                        })
                        .map(([monthName, monthBills]) => (
                          <div 
                            key={monthName} 
                            className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                            onClick={() => setSelectedMonth({ financialYear, monthName })}
                          >
                            <div className="flex justify-between items-center mb-3">
                              <h5 className="font-semibold text-gray-800">{monthName}</h5>
                              <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                                {monthBills.length} bill{monthBills.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            
                            <div className="text-sm text-gray-600">
                              <p>Total: ₹{monthBills.reduce((sum, bill) => sum + bill.total_amount, 0)}</p>
                              <p>Pending: ₹{monthBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}</p>
                            </div>
                            
                            <div className="mt-3 text-xs text-gray-500">
                              Click to view all bills
                            </div>
                          </div>
                        ))
                      }
                    </div>
                    
                    {Object.keys(financialYearGroups[financialYear]).length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-8">No bills for financial year {financialYear}</p>
                    )}
                  </div>
                ))}
                
                {sortedFinancialYears.length === 0 && (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Saved Bills</h4>
                    <p className="text-gray-500">Create bills to see them organized here by month and financial year</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Pending Bill Alert */}
      {showPendingBillAlert && pendingBills.length > 0 && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Pending Bills Found!</strong>
          <span className="block sm:inline"> Shop {currentShop?.shop_name} has {pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''} with total ₹{pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)} due.</span>
          <button
            onClick={() => setShowPendingBillAlert(false)}
            className="absolute top-0 right-0 px-4 py-3"
          >
            <span className="text-yellow-700">×</span>
          </button>
        </div>
      )}

      {showBillingInterface && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Day and Shop Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Select Day & Shop</h3>
                <button
                  onClick={() => setShowBillingInterface(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Back to Bills
                </button>
              </div>
              <div className="space-y-4">
                {/* Day Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Choose Day
                  </label>
                  <select
                    value={selectedDay || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleDaySelect(value || null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select a day...</option>
                    {daysOfWeek.map(day => (
                      <option key={day} value={day}>
                        {day}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Shop Selection */}
                {selectedDay && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Choose Shop ({selectedDay})
                    </label>
                    <select
                      value={selectedShop || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleShopSelect(value ? parseInt(value) : null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!selectedDay}
                    >
                      <option value="">Select a shop...</option>
                      {shops.map(shop => (
                        <option key={shop.id} value={shop.id}>
                          {shop.shop_name}
                        </option>
                      ))}
                    </select>
                    {shops.length === 0 && selectedDay && (
                      <p className="text-sm text-red-600 mt-1">
                        No shops assigned to {selectedDay}. Please assign shops in Schedule.
                      </p>
                    )}
                  </div>
                )}

                {selectedShop && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900">Selected Shop</h4>
                    <p className="text-blue-700">{currentShop?.shop_name}</p>
                    
                    {pendingBills.length > 0 && !isPayPendingMode && (
                      <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                        <p className="text-yellow-800 text-sm font-medium">
                          Total Pending Balance: ₹{pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}
                        </p>
                        <p className="text-yellow-700 text-xs">
                          {pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''} (oldest: {pendingBills[0].id})
                        </p>
                      </div>
                    )}

                    {!isPayPendingMode && (
                      <>
                        <p className="text-blue-600 text-sm mt-2">Total Items: {currentBill.length}</p>
                        <p className="text-blue-600 text-sm">Total Amount: ₹{
                          currentBill.reduce((sum, item) => sum + item.amount + (item.sgst || 0) + (item.cgst || 0), 0) +
                          pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)
                        }</p>

                        {/* Received Amount Input */}
                        <div className="mt-4">
                          <label htmlFor="receivedAmount" className="block text-sm font-medium text-gray-700 mb-1">
                            Received Amount
                          </label>
                          <input
                            type="number"
                            id="receivedAmount"
                            min="0"
                            max={totalAmount + pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}
                            value={receivedAmount}
                            placeholder="0"
                            onChange={(e) => setReceivedAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </>
                    )}

                    {isPayPendingMode && pendingBills.length > 0 && (
                      <>
                        <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                          <p className="text-orange-800 text-sm font-medium">
                            Paying Pending Balance
                          </p>
                          <p className="text-orange-700 text-xs">
                            {pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''} - Total ₹{pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)} due
                          </p>
                        </div>

                        {/* Pending Payment Amount Input */}
                        <div className="mt-4">
                          <label htmlFor="pendingPaymentAmount" className="block text-sm font-medium text-gray-700 mb-1">
                            Payment Amount
                          </label>
                          <input
                            type="number"
                            id="pendingPaymentAmount"
                            min="0"
                            max={pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}
                            value={pendingPaymentAmount.toString()}
                            onChange={(e) => setPendingPaymentAmount(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter payment amount"
                          />
                        </div>

                        <button
                          onClick={handlePayPending}
                          disabled={pendingPaymentAmount <= 0}
                          className="w-full mt-3 inline-flex items-center justify-center px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
                        >
                          Pay Pending ₹{pendingPaymentAmount > 0 ? pendingPaymentAmount : pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}
                        </button>

                        <button
                          onClick={() => setIsPayPendingMode(false)}
                          className="w-full mt-2 inline-flex items-center justify-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition"
                        >
                          Cancel Payment
                        </button>
                      </>
                    )}

                    {pendingBills.length > 0 && !isPayPendingMode && (
                      <button
                        onClick={() => setIsPayPendingMode(true)}
                        className="w-full mt-3 inline-flex items-center justify-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition"
                      >
                        Pay Pending ₹{pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Add Product Form */}
            {selectedShop && !isPayPendingMode && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Add Product</h3>
                <form onSubmit={handleAddProduct} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product
                    </label>
                    <select
                      value={productForm.product_id}
                      onChange={(e) => setProductForm({...productForm, product_id: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select a product...</option>
                      {allProductsForShop.map(product => (
                        <option key={product.product_id} value={product.product_id}>
                          {product.product_name} - ₹{product.price}/{product.unit}
                          {product.price === 0 && ' (Set price in Products section)'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={productForm.quantity}
                      onChange={(e) => setProductForm({...productForm, quantity: parseInt(e.target.value) || 1})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add to Bill
                  </button>
                </form>
              </div>
            )}
          </div>

              {/* Current Bill */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isPayPendingMode ? 'Pending Payment' : 'Current Bill'}
                  </h3>
                  {currentBill.length > 0 && !isPayPendingMode && (
                    <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            if (confirm('Clear current bill?')) {
                              setCurrentBill([]);
                              setHasPrinted(false); // Reset print status when bill is cleared
                            }
                          }}
                          className="inline-flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Clear All
                        </button>
                        <button
                          onClick={() => {
                            const printContent = document.getElementById('current-bill-to-print');
                            if (printContent) {
                              const win = window.open('', '', 'height=600,width=800');
                              if (win) {
                                const shopName = currentShop?.shop_name || 'Shop';
                                const billDate = new Date().toLocaleDateString();
                                
                                win.document.write(`
                                  <html>
                                  <head>
                                    <title>Bill - ${shopName}</title>
                                    <style>
                                      body {
                                        font-family: Arial, sans-serif;
                                        margin: 20px;
                                        line-height: 1.4;
                                      }
                                      .bill-header {
                                        margin-bottom: 20px;
                                      }
                                      .header-row {
                                        display: flex;
                                        justify-content: space-between;
                                        margin-bottom: 15px;
                                      }
                                      .company-name {
                                        font-size: 24px;
                                        font-weight: bold;
                                        text-align: center;
                                        margin-bottom: 10px;
                                      }
                                      .company-address {
                                        text-align: center;
                                        font-size: 14px;
                                        margin-bottom: 5px;
                                      }
                                      .company-city {
                                        text-align: center;
                                        font-size: 14px;
                                        margin-bottom: 15px;
                                      }
                                      .shop-info {
                                        margin-bottom: 10px;
                                        font-size: 14px;
                                      }
                                      .shop-gst {
                                        margin-bottom: 15px;
                                        font-size: 14px;
                                        font-weight: bold;
                                      }
                                      .bill-items {
                                        width: 100%;
                                        border-collapse: collapse;
                                        margin-bottom: 20px;
                                      }
                                      .bill-items th,
                                      .bill-items td {
                                        padding: 8px;
                                        text-align: left;
                                        border-bottom: 1px solid #ddd;
                                      }
                                      .bill-items th {
                                        background-color: #f8f9fa;
                                        font-weight: bold;
                                      }
                                      .bill-totals {
                                        margin-left: auto;
                                        width: 250px;
                                      }
                                      .total-row {
                                        display: flex;
                                        justify-content: space-between;
                                        padding: 4px 0;
                                      }
                                      .dashed-line {
                                        border-bottom: 2px dashed #ccc;
                                        margin: 10px 0;
                                      }
                                      .thank-you {
                                        text-align: center;
                                        margin-top: 30px;
                                        font-weight: bold;
                                      }
                                      @media print {
                                        body { margin: 0; padding: 15px; }
                                        .bill-header { margin-bottom: 15px; }
                                        .company-name { font-size: 20px; }
                                      }
                                    </style>
                                  </head>
                                  <body>
                                   <div class="bill-header" style="text-align:center; margin-bottom:5px;">
  <div style="font-size:10px; font-weight:bold;">
    "ஸ்ரீ தேவி சந்தான மாரியம்மன் துணை"
  </div>
</div>

                                      <div class="header-row">
                                        <div>GST No: 33BAPPS2831B2ZU</div>
                                        <div>Mobile: 8807810021</div>
                                      </div>
                                      <div class="company-name">Sri Devi Snacks</div>
                                      <div class="company-address">128 C Santhanamari Amman Kovil Street</div>
                                      <div class="company-city">Vallioor, Tirunelveli-627117</div>
                                      <div class="bill-no"><strong>Bill No:</strong> ${`B${String(bills.length + 1).padStart(3, '0')}`}</div>
                                      <div class="shop-info"><strong>Shop:</strong> ${shopName}</div>
                                      <div class="shop-gst"><strong>Shop GST No:</strong> ${currentShop?.gst || ''}</div>
                                      <div class="bill-date"><strong>Date:</strong> ${new Date().toLocaleDateString()}</div>
                                      <div class="dashed-line"></div>
                                    </div>
                                `);
                                
                                // Add bill items
                                win.document.write(`
                                  <table class="bill-items">
                                    <thead>
                                      <tr>
                                        <th>Item</th>
                                        <th style="text-align: right;">HSN Code</th>
                                        <th style="text-align: right;">Qty</th>
                                        <th style="text-align: right;">Price</th>
                                        <th style="text-align: right;">Total</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                `);

                                // Regular items
                                currentBill.filter(item => item.quantity > 0).forEach(item => {
                                  win.document.write(`
                                    <tr>
                                      <td>${item.product_name}</td>
                                      <td style="text-align: right;">${item.hsn_code}</td>
                                      <td style="text-align: right;">${item.quantity}</td>
                                      <td style="text-align: right;">₹${item.price}</td>
                                      <td style="text-align: right;">₹${item.amount}</td>
                                    </tr>
                                  `);
                                });
                                
                                // Return items
                                if (currentBill.filter(item => item.quantity < 0).length > 0) {
                                  win.document.write(`
                                    <tr><td colspan="5" style="padding-top: 15px; font-weight: bold;">Return Items</td></tr>
                                  `);
                                  currentBill.filter(item => item.quantity < 0).forEach(item => {
                                    win.document.write(`
                                      <tr>
                                        <td>${item.product_name}</td>
                                        <td style="text-align: right;">${item.hsn_code}</td>
                                        <td style="text-align: right;">${item.quantity}</td>
                                        <td style="text-align: right;">₹${item.price}</td>
                                        <td style="text-align: right;">₹${item.amount}</td>
                                      </tr>
                                    `);
                                  });
                                }
                                
                                win.document.write('</tbody></table>');
                                
                                // Add calculations
                                const itemTotal = currentBill.reduce((sum, item) => sum + item.amount, 0);
                                const sgst = currentBill.reduce((sum, item) => sum + (item.sgst || 0), 0);
                                const cgst = currentBill.reduce((sum, item) => sum + (item.cgst || 0), 0);
                                const pendingAmount = pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0);
                                const finalTotal = itemTotal + sgst + cgst + pendingAmount;

                                win.document.write(`
                                  <div class="bill-totals">
                                    <div class="total-row">
                                      <div>Item Total:</div>
                                      <div>₹${itemTotal}</div>
                                    </div>
                                    <div class="total-row">
                                      <div>SGST:</div>
                                      <div>₹${sgst}</div>
                                    </div>
                                    <div class="total-row">
                                      <div>CGST:</div>
                                      <div>₹${cgst}</div>
                                    </div>
                                `);

                                if (pendingAmount > 0) {
                                  win.document.write(`
                                    <div class="total-row">
                                      <div>Previous Pending:</div>
                                      <div>₹${pendingAmount}</div>
                                    </div>
                                  `);
                                }

                                win.document.write(`
                                    <div class="dashed-line"></div>
                                    <div class="total-row" style="font-weight: bold;">
                                      <div>Final Total:</div>
                                      <div>₹${finalTotal}</div>
                                    </div>
                                  </div>
                                  
                                  <div class="thank-you">
                                    <div class="dashed-line"></div>
                                    <div>Thank you – Visit Again!</div>
                                    <div class="dashed-line"></div>
                                  </div>
                                </body>
                                </html>
                                `);
                                
                                win.document.close();
                                setTimeout(() => {
                                  win.print();
                                  win.close();
                                  setHasPrinted(true); // Mark that bill has been printed
                                }, 100);
                              }
                            }
                          }}
                          className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          Print Bill
                        </button>
                    </div>
                  )}
                </div>
              </div>
              
              {isPayPendingMode ? (
                <div className="p-12 text-center">
                  <Receipt className="h-12 w-12 text-orange-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Paying Pending Balance</h3>
                  <p className="text-gray-500">
                    {pendingBills.length > 0 ? 
                      `Processing payment for ${pendingBills.length} pending bill${pendingBills.length > 1 ? 's' : ''} (₹${pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)})` : 
                      'No pending bills selected'
                    }
                  </p>
                  <div className="mt-6 bg-orange-50 p-4 rounded-lg max-w-md mx-auto">
                    <h4 className="font-medium text-orange-800 mb-2">Payment Instructions</h4>
                    <p className="text-sm text-orange-700">
                      Enter the payment amount and click "Pay Pending" to apply the payment to the outstanding balance.
                      This will not create a new bill.
                    </p>
                  </div>
                </div>
              ) : currentBill.length === 0 ? (
                <div className="p-12 text-center">
                  <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">No items in bill</h3>
                  <p className="text-gray-500">Add products to create a bill</p>
                </div>
              ) : (
                <div className="p-6">
                  {/* Professional Bill Header */}
                  <div id="current-bill-to-print" className="mb-6">
                                                          <div className="text-center text-lg font-semibold" style={{fontSize: '10px'}}>"ஸ்ரீ தேவி சந்தான மாரியம்மன் துணை"</div>

                    {/* Top row with GST and Mobile */}
                    <div className="flex justify-between items-start mb-4">
                      <div className="text-left">
                        <p className="text-sm font-medium">GST No: 33BAPPS2831B2ZU</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">Mobile: 8807810021</p>
                      </div>
                    </div>

                    {/* Company Name */}
                    <div className="text-center mb-2">
                      <h1 className="text-2xl font-bold text-gray-900">Sri Devi Snacks</h1>
                    </div>

                    {/* Company Address */}
                    <div className="text-center mb-1">
                      <p className="text-sm text-gray-700">128 C Santhanamari Amman Kovil Street</p>
                    </div>

                    {/* Company City and PIN */}
                    <div className="text-center mb-4">
                      <p className="text-sm text-gray-700">Vallioor, Tirunelveli-627117</p>
                    </div>

                    {/* Selected Shop Details */}
                    {currentShop && (
                      <div className="mb-4">
                       <p className="text-sm text-gray-700">
  <span className="font-bold">Shop:</span>{" "}
  <span className="font-bold">{currentShop.shop_name}</span>
  {currentShop.address && (
    <span className="font-bold"> - {currentShop.address}</span>
  )}
</p>

<p className="text-sm text-gray-700">
  <span className="font-bold">Shop GST No:</span>{" "}
  <span className="font-bold">{currentShop.gst || "N/A"}</span>
</p>

                        <p className="text-sm text-gray-700">
                          <span className="font-bold">Date:</span> <span className="font-bold">{new Date().toLocaleDateString()}</span>
                        </p>
                      </div>
                    )}

                    <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
                  </div>

                  {/* Bill Items */}
                  <div className="mb-4">
                    <div className="grid grid-cols-5 gap-4 py-2 font-bold border-b">
                      <div>Item</div>
                      <div className="text-right">HSN Code</div>
                      <div className="text-right">Qty</div>
                      <div className="text-right">Price</div>
                      <div className="text-right">Total</div>
                    </div>
                    <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                    {/* Regular Items */}
                    {currentBill.filter(item => item.quantity > 0).map((item) => (
                      <div key={`item-${item.id}`} className="grid grid-cols-5 gap-4 py-2">
                        <div>{item.product_name}</div>
                        <div className="text-right">{item.hsn_code}</div>
                        <div className="text-right">{item.quantity}</div>
                        <div className="text-right">₹{item.price}</div>
                        <div className="text-right">₹{item.amount}</div>
                      </div>
                    ))}
                  </div>

                  {/* Return Items */}
                  {currentBill.filter(item => item.quantity < 0).length > 0 && (
                    <>
                      <div className="mb-4">
                        <div className="font-bold mb-2">Return Items</div>
                        <div className="grid grid-cols-5 gap-4 py-2 font-bold border-b">
                          <div>Item</div>
                          <div className="text-right">HSN Code</div>
                          <div className="text-right">Qty</div>
                          <div className="text-right">Price</div>
                          <div className="text-right">Total</div>
                        </div>
                        <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                        {currentBill.filter(item => item.quantity < 0).map((item) => (
                          <div key={`return-${item.id}`} className="grid grid-cols-5 gap-4 py-2">
                            <div>{item.product_name}</div>
                            <div className="text-right">{item.hsn_code}</div>
                            <div className="text-right">{item.quantity}</div>
                            <div className="text-right">₹{item.price}</div>
                            <div className="text-right">₹{item.amount}</div>
                          </div>
                        ))}
                      </div>
                      <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
                    </>
                  )}

                  {/* Calculations */}
                  <div className="ml-auto w-64">
                    <div className="flex justify-between py-1">
                      <div>Item Total:</div>
                      <div>₹{
                        currentBill
                          .reduce((sum, item) => sum + item.amount, 0)
                      }</div>
                    </div>

                    <div className="flex justify-between py-1">
                      <div>SGST:</div>
                      <div>₹{
                        currentBill
                          .reduce((sum, item) => sum + (item.sgst || 0), 0)
                      }</div>
                    </div>

                    <div className="flex justify-between py-1">
                      <div>CGST:</div>
                      <div>₹{
                        currentBill
                          .reduce((sum, item) => sum + (item.cgst || 0), 0)
                      }</div>
                    </div>

                    {/* Previous Pending Amount */}
                    {pendingBills.length > 0 && (
                      <>
                        <div className="flex justify-between py-1">
                          <div>Previous Pending:</div>
                          <div>₹{pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}</div>
                        </div>
                        <div className="flex justify-between py-1 text-xs text-gray-500">
                          <div>({pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''})</div>
                          <div></div>
                        </div>
                      </>
                    )}

                    <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                    <div className="flex justify-between py-1 font-bold">
                      <div>Final Total:</div>
                      <div>₹{
                        currentBill.reduce((sum, item) => sum + item.amount + (item.sgst || 0) + (item.cgst || 0), 0) +
                        pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)
                      }</div>
                    </div>
                  </div>

                  {/* Thank You Message */}
                  <div className="text-center mt-8">
                    <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
                    <div className="font-bold">Thank you – Visit Again!</div>
                    <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Process Returns</h3>
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
              
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 mb-2">Previous Bill</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-600">Bill ID: B001</p>
                  <p className="text-sm text-gray-600">Date: 2024-01-15</p>
                  <p className="text-sm text-gray-600">Total: ₹1250</p>
                </div>
              </div>
 
              <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
              
              {/* Return Items Input */}
              <div className="mb-4">
                <div className="font-bold mb-2">Return Items</div>
                <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
                
                {previousBills[0]?.items.map((item) => {
                  const returnQuantity = returnQuantities[item.product_id] || 0;
                  const returnAmount = returnQuantity * item.price;
                  
                  return (
                    <div key={`return-input-${item.id}`} className="grid grid-cols-4 gap-4 py-2 items-center">
                      <div>{item.product_name}</div>
                      <div className="text-right">
                        <input
                          type="number"
                          min="0"
                          max={item.quantity}
                          value={returnQuantity}
                          onChange={(e) => handleReturnQuantityChange(item.product_id, parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                        />
                      </div>
                      <div className="text-right">₹{item.price}</div>
                      <div className="text-right text-red-600">₹{returnAmount > 0 ? `-${returnAmount}` : '0'}</div>
                    </div>
                  );
                })}
              </div>
              
              <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
              
              {/* Return Calculations */}
              <div className="ml-auto w-64">
                <div className="flex justify-between py-1">
                  <div>Subtotal:</div>
                  <div>₹{
                    previousBills[0]?.items.reduce((sum, item) => sum + item.amount, 0) || 0
                  }</div>
                </div>
                
                <div className="flex justify-between py-1">
                  <div>Return Amount:</div>
                  <div className="text-red-600">₹-{
                    previousBills[0]?.items.reduce((sum, item) => {
                      const returnQuantity = returnQuantities[item.product_id] || 0;
                      return sum + (returnQuantity * item.price);
                    }, 0) || 0
                  }</div>
                </div>
                
                <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
                
                <div className="flex justify-between py-1 font-bold">
                  <div>Final Total:</div>
                  <div>₹{
                    (previousBills[0]?.items.reduce((sum, item) => sum + item.amount, 0) || 0) - 
                    (previousBills[0]?.items.reduce((sum, item) => {
                      const returnQuantity = returnQuantities[item.product_id] || 0;
                      return sum + (returnQuantity * item.price);
                    }, 0) || 0)
                  }</div>
                </div>
              </div>
              
             

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProcessReturns}
                  className="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition"
                >
                  Process Returns
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* View Bill Modal */}
      {selectedBillForView && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Bill Details</h3>
                <button
                  onClick={() => setSelectedBillForView(null)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
              
              {/* Bill Content for Printing */}
              <div id="bill-to-print" className="p-6">
                {/* Professional Bill Header */}
                <div className="mb-6">
                                                        <div className="text-center text-lg font-semibold" style={{fontSize: '10px'}}>"ஸ்ரீ தேவி சந்தான மாரியம்மன் துணை"</div>

                  {/* Top row with GST and Mobile */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="text-left">
                      <p className="text-sm font-medium">GST No: 33BAPPS2831B2ZU</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">Mobile: 8807810021</p>
                    </div>
                  </div>

                  {/* Company Name */}
                  <div className="text-center mb-2">
                    <h1 className="text-2xl font-bold text-gray-900">Sri Devi Snacks</h1>
                  </div>

                  {/* Company Address */}
                  <div className="text-center mb-1">
                    <p className="text-sm text-gray-700">128 C Santhanamari Amman Kovil Street</p>
                  </div>

                  {/* Company City and PIN */}
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-700">Vallioor, Tirunelveli-627117</p>
                  </div>

                  {/* Selected Shop Details */}
                  {currentShop && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-700">
                        <span className="font-bold">Shop:</span> <span className="font-bold">{currentShop.shop_name}</span>
                        {currentShop.address && ` - ${currentShop.address}`}
                        {currentShop.gst && (
                          <>
                            <span className="mx-4">|</span>
                            <span className="font-bold">Shop GST No:</span> <span className="font-bold">{currentShop.gst}</span>
                          </>
                        )}
                      </p>
                      <p className="text-sm text-gray-700">
                              <span className="font-bold">Date:</span> <span className="font-bold">{selectedBillForView ? new Date(selectedBillForView.bill_date).toLocaleString() : new Date().toLocaleDateString()}</span>
                      </p>
                    </div>
                  )}

                  <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
                </div>
                
                {/* Bill Info */}
                <div className="mb-4">
                  <div className="flex justify-between">
                    <div>Bill ID: {selectedBillForView.id}</div>
                    <div>Date: {new Date(selectedBillForView.bill_date).toLocaleString()}</div>
                  </div>
                  <div className="flex justify-between">
                    <div>Shop: {selectedBillForView.shop_name}</div>
                  </div>
                </div>
                
                {/* Bill Items */}
                <div className="mb-4">
                  <div className="grid grid-cols-5 gap-4 py-2 font-bold border-b">
                    <div>Item</div>
                    <div className="text-right">HSN Code</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Price</div>
                    <div className="text-right">Total</div>
                  </div>
                  <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                  {/* Regular Items */}
                  {selectedBillForView.items.filter(item => item.quantity > 0).map((item) => (
                    <div key={`view-item-${item.id}`} className="grid grid-cols-5 gap-4 py-2">
                      <div>{item.product_name}</div>
                      <div className="text-right">{item.hsn_code || 'N/A'}</div>
                      <div className="text-right">{item.quantity}</div>
                      <div className="text-right">₹{item.price}</div>
                      <div className="text-right">₹{item.amount}</div>
                    </div>
                  ))}
                </div>
                
                {/* Return Items */}
                {selectedBillForView.items.filter(item => item.quantity < 0).length > 0 && (
                  <>
                    <div className="mb-4">
                      <div className="font-bold mb-2">Return Items</div>
                      <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
                      
                      {selectedBillForView.items.filter(item => item.quantity < 0).map((item) => (
                        <div key={`view-return-${item.id}`} className="grid grid-cols-4 gap-4 py-2">
                          <div>{item.product_name}</div>
                          <div className="text-right">{item.quantity}</div>
                          <div className="text-right">₹{item.price}</div>
                          <div className="text-right">₹{item.amount}</div>
                        </div>
                      ))}
                    </div>
                    <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
                  </>
                )}
                
                  {/* Calculations */}
                  <div className="ml-auto w-64">
                    <div className="flex justify-between py-1">
                      <div>Item Total:</div>
                      <div>₹{
                        selectedBillForView.items
                          .reduce((sum, item) => sum + item.amount, 0)
                      }</div>
                    </div>

                    <div className="flex justify-between py-1">
                      <div>SGST:</div>
                      <div>₹{
                        selectedBillForView.items
                          .reduce((sum, item) => sum + (item.sgst || 0), 0)
                      }</div>
                    </div>

                    <div className="flex justify-between py-1">
                      <div>CGST:</div>
                      <div>₹{
                        selectedBillForView.items
                          .reduce((sum, item) => sum + (item.cgst || 0), 0)
                      }</div>
                    </div>

                    {/* Previous Pending Amount - Only show if there is actual previous pending */}
                    {(() => {
                      // Calculate if this bill has previous pending (total_amount > items total + taxes)
                      const itemTotal = selectedBillForView.items.reduce((sum, item) => sum + item.amount, 0);
                      const sgstTotal = selectedBillForView.items.reduce((sum, item) => sum + (item.sgst || 0), 0);
                      const cgstTotal = selectedBillForView.items.reduce((sum, item) => sum + (item.cgst || 0), 0);
                      const currentBillTotal = itemTotal + sgstTotal + cgstTotal;
                      const previousPending = selectedBillForView.total_amount - currentBillTotal;

                      return previousPending > 0 ? (
                        <>
                          <div className="flex justify-between py-1">
                            <div>Previous Pending:</div>
                            <div>₹{previousPending}</div>
                          </div>
                          <div className="flex justify-between py-1 text-xs text-gray-500">
                            <div>(From previous bill)</div>
                            <div></div>
                          </div>
                        </>
                      ) : null;
                    })()}

                    <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                    <div className="flex justify-between py-1 font-bold">
                      <div>Final Total:</div>
                      <div>₹{selectedBillForView.total_amount}</div>
                    </div>

                  {/* Payment Details */}
                  <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                  <div className="flex justify-between py-1">
                    <div>Received Amount:</div>
                    <div>₹{selectedBillForView.received_amount}</div>
                  </div>

                  <div className="flex justify-between py-1">
                    <div>Pending Amount:</div>
                    <div className={selectedBillForView.pending_amount > 0 ? "text-red-600 font-medium" : ""}>
                      ₹{selectedBillForView.pending_amount}
                    </div>
                  </div>

                  <div className="flex justify-between py-1">
                  </div>

                  <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                  <div className="flex justify-between py-1 font-bold">
                    <div>Status:</div>
                    <div className={selectedBillForView.status === 'completed' ? "text-green-600" : "text-yellow-600"}>
                      {selectedBillForView.status.toUpperCase()}
                    </div>
                  </div>
                </div>
                
                {/* Thank You Message */}
                <div className="text-center mt-8">
                  <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
                  <div className="font-bold">Thank you – Visit Again!</div>
                  <div className="border-b-2 border-dashed border-gray-300 my-4"></div>
                </div>
              </div>
              
              {/* Print Button */}
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setSelectedBillForView(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    const printContent = document.getElementById('bill-to-print');
                    if (printContent && selectedBillForView) {
                      const win = window.open('', '', 'height=600,width=800');
                      if (win) {
                        const shopName = selectedBillForView.shop_name;
                        const billDate = selectedBillForView.bill_date;
                        const billId = selectedBillForView.id;
                        
                        win.document.write(`
                          <html>
                          <head>
                            <title>Bill - ${shopName}</title>
                            <style>
                              body {
                                font-family: Arial, sans-serif;
                                margin: 20px;
                                line-height: 1.4;
                              }
                              .bill-header {
                                margin-bottom: 20px;
                              }
                              .header-row {
                                display: flex;
                                justify-content: space-between;
                                margin-bottom: 15px;
                              }
                              .company-name {
                                font-size: 24px;
                                font-weight: bold;
                                text-align: center;
                                margin-bottom: 10px;
                              }
                              .company-address {
                                text-align: center;
                                font-size: 14px;
                                margin-bottom: 5px;
                              }
                              .company-city {
                                text-align: center;
                                font-size: 14px;
                                margin-bottom: 15px;
                              }
                              .shop-info {
                                margin-bottom: 10px;
                                font-size: 14px;
                              }
                              .shop-gst {
                                margin-bottom: 15px;
                                font-size: 14px;
                                font-weight: bold;
                              }
                              .bill-items {
                                width: 100%;
                                border-collapse: collapse;
                                margin-bottom: 20px;
                              }
                              .bill-items th,
                              .bill-items td {
                                padding: 8px;
                                text-align: left;
                                border-bottom: 1px solid #ddd;
                              }
                              .bill-items th {
                                background-color: #f8f9fa;
                                font-weight: bold;
                              }
                              .bill-totals {
                                margin-left: auto;
                                width: 250px;
                              }
                              .total-row {
                                display: flex;
                                justify-content: space-between;
                                padding: 4px 0;
                              }
                              .dashed-line {
                                border-bottom: 2px dashed #ccc;
                                margin: 10px 0;
                              }
                              .thank-you {
                                text-align: center;
                                margin-top: 30px;
                                font-weight: bold;
                              }
                              .payment-details {
                                margin-top: 20px;
                                padding-top: 10px;
                                border-top: 1px solid #eee;
                              }
                              .status-completed { color: #16a34a; }
                              .status-pending { color: #ca8a04; }
                              @media print {
                                body { margin: 0; padding: 15px; }
                                .bill-header { margin-bottom: 15px; }
                                .company-name { font-size: 20px; }
                              }
                            </style>
                          </head>
                          <body>
                           <div class="bill-header" style="text-align:center; margin-bottom:5px;">
  <div style="font-size:10px; font-weight:bold;">
    "ஸ்ரீ தேவி சந்தான மாரியம்மன் துணை"
  </div>
</div>

                              <div class="header-row">
                                <div>GST No: 33BAPPS2831B2ZU</div>
                                <div>Mobile: 8807810021</div>
                              </div>
                              <div class="company-name">Sri Devi Snacks</div>
                              <div class="company-address">128 C Santhanamari Amman Kovil Street</div>
                              <div class="company-city">Vallioor, Tirunelveli-627117</div>
                              <div class="bill-no"><strong>Bill No:</strong> ${billId}</div>
                              <div class="shop-info"><strong>Shop:</strong> ${shopName}</div>
                              <div class="shop-gst"><strong>Shop GST No:</strong> ${selectedBillForView.shop_id === 1 ? '33BBBBB5678B2Y6' : selectedBillForView.shop_id === 2 ? '33CCCCC9012C3Z7' : selectedBillForView.shop_id === 3 ? '33DDDDD3456D4A8' : ''}</div>
                              <div class="bill-date"><strong>Date:</strong> ${selectedBillForView ? new Date(selectedBillForView.bill_date).toLocaleString() : new Date().toLocaleDateString()}</div>
                              <div class="dashed-line"></div>
                            </div>
                        `);
                        
                        // Add bill items
                        win.document.write(`
                          <table class="bill-items">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th style="text-align: right;">HSN Code</th>
                                <th style="text-align: right;">Qty</th>
                                <th style="text-align: right;">Price</th>
                                <th style="text-align: right;">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                        `);

                        // Regular items
                        selectedBillForView.items.filter(item => item.quantity > 0).forEach(item => {
                          win.document.write(`
                            <tr>
                              <td>${item.product_name}</td>
                              <td style="text-align: right;">${item.hsn_code || 'N/A'}</td>
                              <td style="text-align: right;">${item.quantity}</td>
                              <td style="text-align: right;">₹${item.price}</td>
                              <td style="text-align: right;">₹${item.amount}</td>
                            </tr>
                          `);
                        });
                        
                        // Return items
                        if (selectedBillForView.items.filter(item => item.quantity < 0).length > 0) {
                          win.document.write(`
                            <tr><td colspan="5" style="padding-top: 15px; font-weight: bold;">Return Items</td></tr>
                          `);
                          selectedBillForView.items.filter(item => item.quantity < 0).forEach(item => {
                            win.document.write(`
                              <tr>
                                <td>${item.product_name}</td>
                                <td style="text-align: right;">${item.hsn_code || 'N/A'}</td>
                                <td style="text-align: right;">${item.quantity}</td>
                                <td style="text-align: right;">₹${item.price}</td>
                                <td style="text-align: right;">₹${item.amount}</td>
                              </tr>
                            `);
                          });
                        }
                        
                        win.document.write('</tbody></table>');
                        
                        // Add calculations
                        const itemTotal = selectedBillForView.items.reduce((sum, item) => sum + item.amount, 0);
                        const sgst = selectedBillForView.items.reduce((sum, item) => sum + (item.sgst || 0), 0);
                        const cgst = selectedBillForView.items.reduce((sum, item) => sum + (item.cgst || 0), 0);
                        const currentBillTotal = itemTotal + sgst + cgst;
                        const previousPending = selectedBillForView.total_amount - currentBillTotal;

                        win.document.write(`
                          <div class="bill-totals">
                            <div class="total-row">
                              <div>Item Total:</div>
                              <div>₹${itemTotal}</div>
                            </div>
                            <div class="total-row">
                              <div>SGST:</div>
                              <div>₹${sgst}</div>
                            </div>
                            <div class="total-row">
                              <div>CGST:</div>
                              <div>₹${cgst}</div>
                            </div>
                        `);

                        if (previousPending > 0) {
                          win.document.write(`
                            <div class="total-row">
                              <div>Previous Pending:</div>
                              <div>₹${previousPending}</div>
                            </div>
                          `);
                        }

                        win.document.write(`
                            <div class="dashed-line"></div>
                            <div class="total-row" style="font-weight: bold;">
                              <div>Final Total:</div>
                              <div>₹${selectedBillForView.total_amount}</div>
                            </div>
                          </div>
                          
                          <div class="payment-details">
                            <div class="total-row">
                              <div>Received Amount:</div>
                              <div>₹${selectedBillForView.received_amount}</div>
                            </div>
                            <div class="total-row">
                              <div>Pending Amount:</div>
                              <div class="${selectedBillForView.pending_amount > 0 ? 'status-pending' : ''}">₹${selectedBillForView.pending_amount}</div>
                            </div>
                            <div class="dashed-line"></div>
                            <div class="total-row" style="font-weight: bold;">
                              <div>Status:</div>
                              <div class="${selectedBillForView.status === 'completed' ? 'status-completed' : 'status-pending'}">
                                ${selectedBillForView.status.toUpperCase()}
                              </div>
                            </div>
                          </div>
                          
                          <div class="thank-you">
                            <div class="dashed-line"></div>
                            <div>Thank you – Visit Again!</div>
                            <div class="dashed-line"></div>
                          </div>
                        </body>
                        </html>
                        `);
                        
                        win.document.close();
                        setTimeout(() => {
                          win.print();
                          win.close();
                        }, 100);
                      }
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                >
                  Print Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GPay QR Code Modal */}
      {showGPayQR && currentBillForPayment && (
        <GPayQRCode
          billId={currentBillForPayment.id}
          shopId={currentBillForPayment.shop_id}
          shopName={currentBillForPayment.shop_name}
          amount={currentBillForPayment.pending_amount}
          upiId="santhanamvlr@okicici" // Replace with actual shop UPI ID
          onClose={() => setShowGPayQR(false)}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default Billing;
