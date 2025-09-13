import React, { useState } from 'react';
import { Search, Plus, Trash2, Receipt, RotateCcw, Calculator, ShoppingCart, Eye, CreditCard } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { billsAPI } from '../services/api';
import GPayQRCode from './GPayQRCode';
import Logo from '../assets/Logo.png';
import { Pagination } from './Pagination';

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
  hsnCode: string;
}

interface Bill {
  id: string;
  shop_id: number;
  shop_name: string;
  bill_date: string;
  total_amount: number;
  received_amount: number;
  pending_amount: number;
  status: 'PENDING' | 'COMPLETED';
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
  const { products, addBill, shopProducts, updateBill, refreshData } = useAppContext();
  
  // Mock data
  const { weeklySchedule } = useAppContext();

  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalBills, setTotalBills] = React.useState(0);
  const [paginatedBills, setPaginatedBills] = React.useState<Bill[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Pagination for month-wise bills
  const [monthCurrentPage, setMonthCurrentPage] = React.useState(1);
  const [monthTotalPages, setMonthTotalPages] = React.useState(1);
  const monthItemsPerPage = 5;

  // Fetch bills with pagination
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    const fetchBills = async () => {
      setLoading(true);
      try {
        const response = await billsAPI.getBills({
          page: currentPage,
          limit: 5, // Show 5 bills per page
        });
        if (response.success) {
          setPaginatedBills(response.data);
          setTotalPages(response.pagination.totalPages);
          setTotalBills(response.pagination.total);
        }
      } catch (error) {
        console.error('Failed to fetch bills:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBills();
  }, [currentPage, refreshTrigger]);

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

  // Helper function to convert backend status to frontend status
  const convertStatusToFrontend = (status: 'PENDING' | 'COMPLETED'): 'pending' | 'completed' => {
    return status.toLowerCase() as 'pending' | 'completed';
  };

  // Helper function to convert frontend status to backend status
  const convertStatusToBackend = (status: 'pending' | 'completed'): 'PENDING' | 'COMPLETED' => {
    return status.toUpperCase() as 'PENDING' | 'COMPLETED';
  };
  const [returnQuantities, setReturnQuantities] = useState<{[key: number]: string}>({});
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

  // Reset month pagination when month changes
  React.useEffect(() => {
    setMonthCurrentPage(1);
  }, [selectedMonth]);

  // State for selected bill for returns
  const [selectedBillForReturn, setSelectedBillForReturn] = useState<Bill | null>(null);

  // State for payment bill mode
  const [isPaymentBillMode, setIsPaymentBillMode] = useState(false);
  const [showPaymentConfirmation, setShowPaymentConfirmation] = useState(false);
  const [paymentBillData, setPaymentBillData] = useState<{
    shopId: number;
    receivedAmount: number;
    applyToPending: boolean;
  } | null>(null);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  const [productForm, setProductForm] = useState({
    product_id: '',
    quantity: ''
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
          const productData = {
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
          return productData;
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
    setProductForm({ product_id: '', quantity: '' });
    setPaymentCompleted(false);
  };

  const handleShopSelect = (shopId: number | null) => {
    if (currentBill.length > 0 && shopId !== null) {
        alert('You cannot change the shop while there are items in the current bill.');
        return;
    }
    if (shopId === null) {
      setSelectedShop(null);
      setProductForm({ product_id: '', quantity: '' });
      setPendingBills([]);
      setIsPayPendingMode(false);
      setPendingPaymentAmount(0);
      setPaymentCompleted(false);
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
      bill.shop_id === shopId && bill.status === 'PENDING'
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
    
    setProductForm({ product_id: '', quantity: '' });
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();

    const productId = parseInt(productForm.product_id);
    const quantity = parseInt(productForm.quantity) || 1;

    // Validate quantity
    if (quantity < 1) {
      alert('Quantity must be at least 1');
      return;
    }

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

    const totalRequestedQuantity = quantity +
      (currentBill.find(item => item.product_id === product.product_id)?.quantity || 0);

    if (totalRequestedQuantity > baseProduct.quantity) {
      alert(`Not enough stock available! Available: ${baseProduct.quantity}, Requested: ${totalRequestedQuantity}`);
      return;
    }

    const existingItemIndex = currentBill.findIndex(item => item.product_id === product.product_id);

    if (existingItemIndex >= 0) {
      // Update existing item
      const updatedBill = [...currentBill];
      updatedBill[existingItemIndex].quantity += quantity;
      updatedBill[existingItemIndex].amount = updatedBill[existingItemIndex].quantity * updatedBill[existingItemIndex].price;
      // Recalculate SGST and CGST only for positive quantity items (sales)
      if (product.gst && updatedBill[existingItemIndex].quantity > 0) {
        const gstAmount = (updatedBill[existingItemIndex].amount * product.gst) / 100;
        updatedBill[existingItemIndex].sgst = gstAmount / 2;
        updatedBill[existingItemIndex].cgst = gstAmount / 2;
      } else {
        // For return items, set SGST and CGST to 0
        updatedBill[existingItemIndex].sgst = 0;
        updatedBill[existingItemIndex].cgst = 0;
      }
      setCurrentBill(updatedBill);
    } else {
      // Add new item
      const amount = product.price * quantity;
      const newItem: BillItem = {
        id: Date.now(),
        product_id: product.product_id,
        product_name: product.product_name,
        price: product.price,
        quantity: quantity,
        amount: amount,
        unit: product.unit,
        hsnCode: product.hsn_code
      };

      // Calculate SGST and CGST only for positive quantity items (sales)
      if (product.gst && quantity > 0) {
        const gstAmount = (amount * product.gst) / 100;
        newItem.sgst = gstAmount / 2;
        newItem.cgst = gstAmount / 2;
      } else {
        // For return items, set SGST and CGST to 0
        newItem.sgst = 0;
        newItem.cgst = 0;
      }

      setCurrentBill([...currentBill, newItem]);
      setHasPrinted(false); // Reset print status when items are added
    }

    setProductForm({ product_id: '', quantity: '' });
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

  const handlePayPending = async () => {
    if (pendingBills.length === 0 || !selectedShop || pendingPaymentAmount <= 0) {
      return; // No validation messages, just silently return
    }

    try {
      let remainingPayment = pendingPaymentAmount;

      // Apply payment to bills in order (oldest first)
      for (let i = 0; i < pendingBills.length && remainingPayment > 0; i++) {
        const bill = pendingBills[i];
        const paymentAmount = Math.min(remainingPayment, bill.pending_amount);
        const newReceivedAmount = bill.received_amount + paymentAmount;

        // Update the bill via backend API (this will update global bills state with correct pending_amount and status)
        await updateBill(bill.id, {
          receivedAmount: newReceivedAmount,
        });

        remainingPayment -= paymentAmount;
      }

      // Refresh pending bills from updated global bills state
      const shopPendingBills = bills.filter(bill =>
        bill.shop_id === selectedShop && bill.status === 'PENDING'
      ).sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime());

      setPendingBills(shopPendingBills);

      // Reset payment amount but keep the mode
      setPendingPaymentAmount(0);

      // Show success message
      const totalPaid = pendingPaymentAmount - remainingPayment;
      if (totalPaid > 0) {
        const remainingBalance = shopPendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0);
        alert(`Payment of ₹${totalPaid} applied to pending bills. Remaining balance: ₹${remainingBalance}`);
        setPaymentCompleted(true);
        setShowBillingInterface(false);
        setSelectedMonth(null); // Reset to show financial year overview
        setRefreshTrigger(prev => prev + 1); // Trigger bills list refresh
        setShowPendingBillAlert(false); // Hide pending alert after payment
      }
    } catch (error) {
      console.error('Failed to update pending payments:', error);
      alert('Failed to update pending payments. Please try again.');
    }
  };

  const handleSaveBill = async () => {
    if (!selectedShop) {
      alert('Please select a shop first');
      return;
    }

    // Handle payment bill mode (no items, only payment)
    if (isPaymentBillMode) {
      const paymentAmount = parseFloat(receivedAmount || "0");
      if (paymentAmount <= 0) {
        alert('Please enter a payment amount');
        return;
      }

      // Show confirmation dialog for payment bills
      setPaymentBillData({
        shopId: selectedShop,
        receivedAmount: paymentAmount,
        applyToPending: true // Always apply to pending for payment bills
      });
      setShowPaymentConfirmation(true);
      return;
    }

    // Handle normal bill with items
    if (currentBill.length === 0) {
      alert('Please add items to the bill');
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

    // Calculate pending amount including taxes
    const pendingAmount = Math.max(0, finalTotal - parseFloat(receivedAmount || "0"));
    const billStatus = pendingAmount > 0 ? 'PENDING' : 'COMPLETED';

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
            rate: item.price,
            sgst: item.sgst || 0,
            cgst: item.cgst || 0,
            hsnCode: item.hsnCode
          }))
        };

    try {
      // Use the context's addBill method which automatically handles stock updates
      await addBill(newBill);

      // If there was excess payment that might have been applied to pending bills, refresh data
      if (parseFloat(receivedAmount || "0") > finalTotal) {
        await refreshData();
      }

      // Refresh pending bills from updated global bills state if shop is selected
      if (selectedShop) {
        const shopPendingBills = bills.filter(bill =>
          bill.shop_id === selectedShop && bill.status === 'PENDING'
        ).sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime());

        setPendingBills(shopPendingBills);
        setShowPendingBillAlert(shopPendingBills.length > 0);
      }

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
      setSelectedMonth(null); // Reset to show financial year overview
      alert(`Bill ${newBill.id} saved successfully!\nFinal Amount: ₹${finalTotal}\nStatus: ${billStatus}\nStock updated for sold items.`);
    } catch (error: any) {
      console.error('Failed to save bill:', error);
      alert(`Failed to save bill: ${error.message || 'Unknown error occurred'}`);
      // Don't reset the form on error so user can try again
    }
  };

  // Handle payment bill confirmation
  const handlePaymentBillConfirm = async () => {
    if (!paymentBillData) return;

    try {
      // Create payment bill with applyToPending flag
      const billData = {
        shopId: paymentBillData.shopId,
        receivedAmount: paymentBillData.receivedAmount,
        applyToPending: paymentBillData.applyToPending,
        items: [], // Empty items array for payment bill
        sgst: 0,
        cgst: 0
      };

      const response = await billsAPI.createBill(billData);

      if (response.success) {
        // Refresh bills data to see updated pending amounts and statuses
        await refreshData();
        setRefreshTrigger(prev => prev + 1); // Trigger bills list refresh
        alert(`Payment of ₹${paymentBillData.receivedAmount} applied successfully to pending bills!`);
        setPaymentCompleted(true);
        setShowBillingInterface(false);
        setSelectedMonth(null); // Reset to show financial year overview
        setShowPendingBillAlert(false); // Hide pending alert after payment
      } else {
        throw new Error(response.message || 'Failed to process payment');
      }
    } catch (error) {
      console.error('Payment bill creation error:', error);
      alert('Failed to process payment. Please try again.');
    } finally {
      setShowPaymentConfirmation(false);
      setPaymentBillData(null);
      setReceivedAmount("0");
      setIsPaymentBillMode(false);
    }
  };

  // Handle payment bill cancellation
  const handlePaymentBillCancel = () => {
    setShowPaymentConfirmation(false);
    setPaymentBillData(null);
  };

  const handleShowReturns = () => {
    if (!selectedShop) {
      alert('Please select a shop first');
      return;
    }

    // Initialize return quantities for all products as empty string for empty input
    const initialReturnQuantities: {[key: number]: string} = {};
    products.forEach(product => {
      initialReturnQuantities[product.id] = '';
    });

    setReturnQuantities(initialReturnQuantities);
    setShowReturnModal(true);
  };

  const handleReturnQuantityChange = (productId: number, returnQuantity: string) => {
    setReturnQuantities({
      ...returnQuantities,
      [productId]: returnQuantity
    });
  };

  const handleProcessReturns = () => {
    // Validate no negative quantities
    for (const [productId, quantityStr] of Object.entries(returnQuantities)) {
      const quantity = parseInt(quantityStr);
      if (!isNaN(quantity) && quantity < 0) {
        alert('Return quantity cannot be less than 0');
        return;
      }
    }

    // Get products with return quantities greater than 0
    const productsToReturn = Object.entries(returnQuantities)
      .filter(([_, quantityStr]) => {
        const quantity = parseInt(quantityStr);
        return !isNaN(quantity) && quantity > 0;
      })
      .map(([productId, quantityStr]) => {
        const product = allProductsForShop.find(p => p.product_id === parseInt(productId));
        return {
          product,
          quantity: parseInt(quantityStr)
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
        
        // For return items, set SGST and CGST to 0 (no tax for returns)
        updatedBill[existingReturnItemIndex].sgst = 0;
        updatedBill[existingReturnItemIndex].cgst = 0;
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
          hsnCode: product.hsn_code
        };
        
        // For return items, set SGST and CGST to 0 (no tax for returns)
        returnItem.sgst = 0;
        returnItem.cgst = 0;
        
        updatedBill.push(returnItem);
      }
    });

    setCurrentBill(updatedBill);
    alert('Return processed successfully!');
    
    setShowReturnModal(false);
    setReturnQuantities({});
  };

  const handleGPayPayment = async () => {
    if (!selectedShop) {
      alert('Please select a shop first');
      return;
    }

    try {
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
        status: pendingAmount > 0 ? 'PENDING' : 'COMPLETED',
        items: currentBill.map(item => ({
          ...item,
          sgst: item.sgst || 0,
          cgst: item.cgst || 0
        }))
      };

      // First save the bill to backend to get the actual ID
      await addBill(billForPayment);

      // Get the newly created bill from the bills array (it will have the backend ID)
      const savedBill = bills[bills.length - 1];
      if (savedBill) {
        setCurrentBillForPayment(savedBill);
        setShowGPayQR(true);
      } else {
        alert('Failed to save bill. Please try again.');
      }
    } catch (error) {
      console.error('Failed to save bill for payment:', error);
      alert('Failed to prepare bill for payment. Please try again.');
    }
  };

  const handlePaymentSuccess = async (transactionId: string, paidAmount: number) => {
    if (!currentBillForPayment) return;

    try {
      // Update the bill via backend API (this will update global bills state with correct pending_amount and status)
      const newReceivedAmount = currentBillForPayment.received_amount + paidAmount;

      await updateBill(currentBillForPayment.id, {
        receivedAmount: newReceivedAmount,
      });

      // Refresh pending bills from updated global bills state if shop is selected
      if (selectedShop) {
        const shopPendingBills = bills.filter(bill =>
          bill.shop_id === selectedShop && bill.status === 'PENDING'
        ).sort((a, b) => new Date(a.bill_date).getTime() - new Date(b.bill_date).getTime());

        setPendingBills(shopPendingBills);
        setShowPendingBillAlert(shopPendingBills.length > 0);
      }

      // Get the updated bill status
      const updatedBill = bills.find(b => b.id === currentBillForPayment.id);
      const statusMessage = updatedBill && updatedBill.pending_amount === 0 ? 'Completed' : 'Partially Paid';

      alert(`Payment of ₹${paidAmount} processed successfully via GPay!\nTransaction ID: ${transactionId}\nBill ${currentBillForPayment.id} updated to ${statusMessage} status.`);

      // Reset states
      setCurrentBill([]);
      setReceivedAmount("0");
      setSelectedShop(null);
      setShowBillingInterface(false);
      setIsPayPendingMode(false);
      setPendingPaymentAmount(0);
      setCurrentBillForPayment(null);
    } catch (error) {
      console.error('Failed to update bill payment:', error);
      alert('Failed to update bill payment. Please try again.');
    }
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

  // Calculate month pagination data
  const monthPaginationData = React.useMemo(() => {
    if (!selectedMonth) return null;

    const { financialYear, monthName } = selectedMonth;
    const monthBills = groupedBills[financialYear]?.[monthName] || [];

    // Sort bills by date (most recent first)
    const sortedMonthBills = monthBills
      .slice()
      .sort((a, b) => {
        return new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime();
      });

    const monthTotalItems = sortedMonthBills.length;
    const monthStartIndex = (monthCurrentPage - 1) * monthItemsPerPage;
    const monthEndIndex = monthStartIndex + monthItemsPerPage;
    const paginatedMonthBills = sortedMonthBills.slice(monthStartIndex, monthEndIndex);

    // Calculate total bills in the financial year
    const financialYearBills = Object.values(groupedBills[financialYear] || {}).flat();
    const financialYearBillCount = financialYearBills.length;

    return {
      sortedMonthBills,
      paginatedMonthBills,
      monthTotalItems,
      financialYearBillCount
    };
  }, [selectedMonth, groupedBills, monthCurrentPage, monthItemsPerPage]);

  // Update month total pages when month pagination data changes
  React.useEffect(() => {
    if (monthPaginationData) {
      const newMonthTotalPages = Math.ceil(monthPaginationData.monthTotalItems / monthItemsPerPage);
      setMonthTotalPages(newMonthTotalPages);
      // Reset to first page if current page exceeds total pages
      if (monthCurrentPage > newMonthTotalPages && newMonthTotalPages > 0) {
        setMonthCurrentPage(1);
      }
    }
  }, [monthPaginationData?.monthTotalItems, monthCurrentPage, monthItemsPerPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleMonthPageChange = (page: number) => {
    setMonthCurrentPage(page);
  };

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
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setShowBillingInterface(true);
              setIsPayPendingMode(false);
              setPendingPaymentAmount(0);
              setIsPaymentBillMode(false);
              setPaymentCompleted(false);
            }}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            <Receipt className="h-5 w-5 mr-2" />
            Create Bill
          </button>

          {/* <button
            onClick={() => {
              setShowBillingInterface(true);
              setIsPayPendingMode(false);
              setPendingPaymentAmount(0);
              setIsPaymentBillMode(true);
            }}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            Payment Only
          </button> */}
        </div>
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
            disabled={
              paymentCompleted ||
              (isPaymentBillMode
                ? (pendingBills.length === 0 || parseFloat(receivedAmount || "0") <= 0)
                : ((currentBill.length > 0 && !hasPrinted) || (currentBill.length === 0 && (pendingBills.length === 0 || parseFloat(receivedAmount || "0") <= 0))))
            }
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
          >
            <CreditCard className="h-5 w-5 mr-2" />
            {isPaymentBillMode ? 'Process Payment' : 'Save Bill'}
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
            // Sort financial years in descending order
            const sortedFinancialYears = Object.keys(groupedBills).sort((a, b) => {
              const [aStart] = a.split('-').map(Number);
              const [bStart] = b.split('-').map(Number);
              return bStart - aStart;
            });

            // If a specific month is selected, show bills for that month
            if (selectedMonth && monthPaginationData) {
              const { financialYear, monthName } = selectedMonth;
              const { paginatedMonthBills, sortedMonthBills } = monthPaginationData;

              return (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">
                    {monthName} {financialYear}
                  </h4>

                  <div className="space-y-4">
              {paginatedMonthBills.map((bill) => (
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
      bill.status === 'COMPLETED'
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
                      {bill.status !== 'COMPLETED' && (
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

                    {sortedMonthBills.length === 0 && (
                      <div className="text-center py-8">
                        <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-sm text-gray-500">No bills found for {monthName} {financialYear}</p>
                      </div>
                    )}
                  </div>

                  {/* Pagination for month bills */}
                  {monthPaginationData?.financialYearBillCount > 5 && (
                    <div className="mt-6">
                      <Pagination
                        currentPage={monthCurrentPage}
                        totalPages={monthTotalPages}
                        onPageChange={handleMonthPageChange}
                      />
                    </div>
                  )}
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
                      {Object.entries(groupedBills[financialYear])
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
                            <p>Total: ₹{monthBills.reduce((sum, bill) => sum + bill.total_amount, 0).toFixed(2)}</p>
                            <p>Pending: ₹{monthBills.reduce((sum, bill) => sum + bill.pending_amount, 0).toFixed(2)}</p>
                            </div>

                            <div className="mt-3 text-xs text-gray-500">
                              Click to view all bills
                            </div>
                          </div>
                        ))
                      }
                    </div>

                    {Object.keys(groupedBills[financialYear]).length === 0 && (
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

      {/* Enhanced Pending Bill Alert */}
      {showPendingBillAlert && pendingBills.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-yellow-50 border-l-4 border-red-400 p-4 mb-6 rounded-r-lg shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-red-800">
                  Outstanding Balance Alert
                </h3>
                <button
                  onClick={() => setShowPendingBillAlert(false)}
                  className="ml-4 text-red-400 hover:text-red-600 transition-colors"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="mt-2">
                <p className="text-sm text-red-700">
                  <span className="font-medium">{currentShop?.shop_name}</span> has{' '}
                  <span className="font-semibold">{pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''}</span>{' '}
                  with a total outstanding balance of{' '}
                  <span className="font-bold text-lg">₹{pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0).toLocaleString()}</span>
                </p>  
              </div>
            </div>
          </div>
        </div>
      )}

      {showBillingInterface && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Day and Shop Selection */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  {isPaymentBillMode ? 'Payment Bill Setup' : 'Select Day & Shop'}
                </h3>
                <button
                  onClick={() => {
                    setShowBillingInterface(false);
                    setIsPaymentBillMode(false);
                  }}
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
                  <div className={`p-4 rounded-lg ${isPaymentBillMode ? 'bg-green-50' : 'bg-blue-50'}`}>
                    <h4 className={`font-medium ${isPaymentBillMode ? 'text-green-900' : 'text-blue-900'}`}>
                      {isPaymentBillMode ? 'Payment Setup' : 'Selected Shop'}
                    </h4>
                    <p className={`${isPaymentBillMode ? 'text-green-700' : 'text-blue-700'}`}>
                      {currentShop?.shop_name}
                    </p>

                    {isPaymentBillMode ? (
                      <>
                        {pendingBills.length > 0 ? (
                          <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                            <p className="text-yellow-800 text-sm font-medium">
                              Total Pending Balance: ₹{pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}
                            </p>
                            <p className="text-yellow-700 text-xs">
                              {pendingBills.length} pending bill{pendingBills.length > 1 ? 's' : ''} (oldest: {pendingBills[0].id})
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 p-3 bg-gray-100 border border-gray-300 rounded-lg">
                            <p className="text-gray-800 text-sm font-medium">
                              No Pending Bills
                            </p>
                            <p className="text-gray-700 text-xs">
                              This shop has no outstanding balances to pay.
                            </p>
                          </div>
                        )}

                        {/* Payment Amount Input */}
                        <div className="mt-4">
                          <label htmlFor="receivedAmount" className="block text-sm font-medium text-gray-700 mb-1">
                            Payment Amount
                          </label>
                          <input
                            type="number"
                            id="receivedAmount"
                            min="0"
                            max={pendingBills.length > 0 ? pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0) : undefined}
                            value={receivedAmount}
                            placeholder="0"
                            onChange={(e) => setReceivedAmount(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            disabled={pendingBills.length === 0}
                          />
                          {pendingBills.length === 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                              No pending bills to pay
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
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
                              (
                                currentBill.reduce((sum, item) => sum + item.amount + (item.sgst || 0) + (item.cgst || 0), 0) +
                                pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)
                              ).toFixed(2)
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

                    {pendingBills.length > 0 && !isPayPendingMode && currentBill.length === 0 && (
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

            {/* Add Product Form - Only show in normal bill mode */}
            {selectedShop && !isPayPendingMode && !isPaymentBillMode && (
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
                          {product.product_name}
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
                      placeholder="1"
                      value={productForm.quantity}
                      onChange={(e) => setProductForm({...productForm, quantity: e.target.value})}
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

              {/* Current Bill / Payment Bill */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isPaymentBillMode ? 'Payment Bill' : isPayPendingMode ? 'Pending Payment' : 'Current Bill'}
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

                                      <div style="text-align:center; margin-bottom:5px;">
                                        <img src="${Logo}" alt="Sri Devi Snacks Logo" style="width: 100px; height: auto; margin: 0 auto;" />
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
                                      <td style="text-align: right;">${item.hsnCode || 'N/A'}</td>
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
                                <td style="text-align: right;">${item.hsnCode || 'N/A'}</td>
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
              
              {isPaymentBillMode ? (
                <div className="p-12 text-center">
                  <CreditCard className="h-12 w-12 text-green-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-1">Payment Bill</h3>
                  <p className="text-gray-500 mb-6">
                    {pendingBills.length > 0 ?
                      `Apply payment to ${pendingBills.length} pending bill${pendingBills.length > 1 ? 's' : ''} (₹${pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)})` :
                      'No pending bills available for payment'
                    }
                  </p>

                  {pendingBills.length > 0 && (
                    <div className="max-w-md mx-auto">
                      <div className="bg-green-50 p-4 rounded-lg mb-4">
                        <h4 className="font-medium text-green-800 mb-2">Payment Details</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-green-700">Total Pending:</span>
                            <span className="font-semibold text-green-800">₹{pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-700">Payment Amount:</span>
                            <span className="font-semibold text-green-800">₹{parseFloat(receivedAmount || "0")}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-green-700">Remaining:</span>
                            <span className="font-semibold text-green-800">
                              ₹{Math.max(0, pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0) - parseFloat(receivedAmount || "0"))}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <h4 className="font-medium text-yellow-800 mb-2">Payment Instructions</h4>
                        <p className="text-sm text-yellow-700">
                          This will create a payment bill and automatically apply the payment to outstanding bills in order (oldest first).
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : isPayPendingMode ? (
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

                    {/* Logo */}
                    <div className="text-center mb-1">
                      <img src={Logo} alt="Sri Devi Snacks Logo" className="mx-auto" style={{width: '100px', height: 'auto'}} />
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
                    {currentBill.filter(item => item.quantity > 0).map((item) => {
                      return (
                        <div key={`item-${item.id}`} className="grid grid-cols-5 gap-4 py-2">
                          <div>{item.product_name}</div>
                          <div className="text-right">{item.hsnCode || 'N/A'}</div>
                          <div className="text-right">{item.quantity}</div>
                          <div className="text-right">₹{item.price}</div>
                          <div className="text-right">₹{item.amount}</div>
                        </div>
                      );
                    })}
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

                        {currentBill.filter(item => item.quantity < 0).map((item) => {
                          return (
                            <div key={`return-${item.id}`} className="grid grid-cols-5 gap-4 py-2">
                              <div>{item.product_name}</div>
                              <div className="text-right">{item.hsnCode || 'N/A'}</div>
                              <div className="text-right">{item.quantity}</div>
                              <div className="text-right">₹{item.price}</div>
                              <div className="text-right">₹{item.amount}</div>
                            </div>
                          );
                        })}
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
                        .reduce((sum, item) => sum + item.amount, 0).toFixed(2)
                    }</div>
                    </div>

                    <div className="flex justify-between py-1">
                      <div>SGST:</div>
                    <div>₹{
                      currentBill
                        .reduce((sum, item) => sum + (item.sgst || 0), 0).toFixed(2)
                    }</div>
                    </div>

                    <div className="flex justify-between py-1">
                      <div>CGST:</div>
                    <div>₹{
                      currentBill
                        .reduce((sum, item) => sum + (item.cgst || 0), 0).toFixed(2)
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
                        (
                          currentBill.reduce((sum, item) => sum + item.amount + (item.sgst || 0) + (item.cgst || 0), 0) +
                          pendingBills.reduce((sum, bill) => sum + bill.pending_amount, 0)
                        ).toFixed(2)
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
                <h4 className="font-medium text-gray-900 mb-2">Process Returns for {currentShop?.shop_name}</h4>
              </div>
 
              <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
              
              {/* Return Items Input */}
              <div className="mb-4">
                <div className="font-bold mb-2">Return Items</div>
                <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                {products.map((product) => {
                  const shopPricing = shopProducts.find(sp =>
                    sp.shop_id === selectedShop && sp.product_id === product.id
                  );
                  const price = shopPricing ? shopPricing.price : product.price;
                  const returnQuantity = returnQuantities[product.id] || '';
                  const returnQuantityNumber = parseInt(returnQuantity) || 0;
                  const returnAmount = returnQuantityNumber * price;

                  return (
                    <div key={`return-input-${product.id}`} className="grid grid-cols-4 gap-4 py-2 items-center">
                      <div>{product.product_name}</div>
                      <div className="text-right">
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={returnQuantity}
                          onChange={(e) => handleReturnQuantityChange(product.id, e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-right"
                        />
                      </div>
                      <div className="text-right">₹{price}</div>
                      <div className="text-right text-red-600">₹{returnAmount > 0 ? `-${returnAmount}` : '0'}</div>
                    </div>
                  );
                })}
              </div>
              
              <div className="border-b-2 border-dashed border-gray-300 my-2"></div>
              
              {/* Return Calculations */}
              <div className="ml-auto w-64">
                <div className="flex justify-between py-1">
                  <div>Return Amount:</div>
                  <div className="text-red-600">₹-{
                    products.reduce((sum, product) => {
                      const shopPricing = shopProducts.find(sp =>
                        sp.shop_id === selectedShop && sp.product_id === product.id
                      );
                      const price = shopPricing ? shopPricing.price : product.price;
                      const returnQuantity = parseInt(returnQuantities[product.id] || '0') || 0;
                      return sum + (returnQuantity * price);
                    }, 0)
                  }</div>
                </div>

                <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                <div className="flex justify-between py-1 font-bold">
                  <div>Total Return Value:</div>
                  <div className="text-red-600">₹-{
                    products.reduce((sum, product) => {
                      const shopPricing = shopProducts.find(sp =>
                        sp.shop_id === selectedShop && sp.product_id === product.id
                      );
                      const price = shopPricing ? shopPricing.price : product.price;
                      const returnQuantity = parseInt(returnQuantities[product.id] || '0') || 0;
                      return sum + (returnQuantity * price);
                    }, 0)
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

                  {/* Logo */}
                  <div className="text-center mb-1">
                    <img src={Logo} alt="Sri Devi Snacks Logo" className="mx-auto" style={{width: '100px', height: 'auto'}} />
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
                      <div className="text-right">{item.hsnCode || (item as any).product?.hsn_code || 'N/A'}</div>
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
                        <div key={`view-return-${item.id}`} className="grid grid-cols-5 gap-4 py-2">
                          <div>{item.product_name}</div>
                          <div className="text-right">{item.hsnCode || (item as any).product?.hsn_code || 'N/A'}</div>
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
                        .reduce((sum, item) => sum + item.amount, 0).toFixed(2)
                    }</div>
                    </div>

                    <div className="flex justify-between py-1">
                      <div>SGST:</div>
                    <div>₹{
                      selectedBillForView.items
                        .reduce((sum, item) => sum + (item.sgst || 0), 0).toFixed(2)
                    }</div>
                    </div>

                    <div className="flex justify-between py-1">
                      <div>CGST:</div>
                    <div>₹{
                      selectedBillForView.items
                        .reduce((sum, item) => sum + (item.cgst || 0), 0).toFixed(2)
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
                      <div>₹{selectedBillForView.total_amount.toFixed(2)}</div>
                    </div>

                  {/* Payment Details */}
                  <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                  <div className="flex justify-between py-1">
                    <div>Received Amount:</div>
                    <div>₹{selectedBillForView.received_amount.toFixed(2)}</div>
                  </div>

                  <div className="flex justify-between py-1">
                    <div>Pending Amount:</div>
                    <div className={selectedBillForView.pending_amount > 0 ? "text-red-600 font-medium" : ""}>
                      ₹{selectedBillForView.pending_amount.toFixed(2)}
                    </div>
                  </div>

                  <div className="flex justify-between py-1">
                  </div>

                  <div className="border-b-2 border-dashed border-gray-300 my-2"></div>

                  <div className="flex justify-between py-1 font-bold">
                    <div>Status:</div>
                    <div className={selectedBillForView.status === 'COMPLETED' ? "text-green-600" : "text-yellow-600"}>
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

                              <div style="text-align:center; margin-bottom:5px;">
                                <img src="${Logo}" alt="Sri Devi Snacks Logo" style="width: 100px; height: auto; margin: 0 auto;" />
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
                              <td style="text-align: right;">${item.hsnCode || (item as any).product?.hsn_code || 'N/A'}</td>
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
                                <td style="text-align: right;">${item.hsnCode || (item as any).product?.hsn_code || 'N/A'}</td>
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
                              <div class="${selectedBillForView.status === 'COMPLETED' ? 'status-completed' : 'status-pending'}">
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

      {/* Payment Confirmation Dialog */}
      {showPaymentConfirmation && paymentBillData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-md shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">Confirm Payment</h3>
                <button
                  onClick={handlePaymentBillCancel}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>

              <div className="mb-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h4 className="text-sm font-medium text-yellow-800">Payment Confirmation</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        This will create a payment bill and apply the amount to outstanding pending bills for {currentShop?.shop_name}.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Shop:</span>
                    <span className="text-sm text-gray-900">{currentShop?.shop_name}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Payment Amount:</span>
                    <span className="text-sm font-semibold text-green-600">₹{paymentBillData.receivedAmount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Apply to Pending:</span>
                    <span className="text-sm text-blue-600">{paymentBillData.applyToPending ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={handlePaymentBillCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePaymentBillConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition"
                >
                  Confirm Payment
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
