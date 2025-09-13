import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { productsAPI, billsAPI, schedulesAPI, shopsAPI, stocksAPI } from '../services/api';

interface Product {
  id: number;
  product_name: string;
  unit: string;
  status: 'active' | 'inactive';
  created_date: string;
  gst: number;
  quantity: number;
  rate: number;
  hsn_code: string;
  price: number;
  stockId: number | null;
}

interface ShopProduct {
  id: number;
  shop_id: number;
  product_id: number;
  price: number;
  shop_name: string;
  product_name: string;
  unit: string;
  gst: number;
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
  status: 'PENDING' | 'COMPLETED';
  items: any[];
}

interface Shop {
  id: number;
  shop_name: string;
  address: string;
  contact: string;
  email?: string;
  gst?: string;
  status: 'active' | 'inactive';
  created_date: string;
}

export interface DaySchedule {
  day: string;
  shops: Shop[];
}

interface AppContextType {
  products: Product[];
  setProducts: (products: Product[]) => void;
  shopProducts: ShopProduct[];
  setShopProducts: (shopProducts: ShopProduct[]) => void;
  shops: Shop[];
  setShops: (shops: Shop[]) => void;
  bills: Bill[];
  setBills: (bills: Bill[]) => void;
  weeklySchedule: DaySchedule[];
  setWeeklySchedule: (schedule: DaySchedule[]) => void;
  updateProductStock: (productId: number, quantity: number) => void;
  addBill: (bill: Bill) => Promise<void>;
  updateBill: (id: string, updateData: { receivedAmount?: number; notes?: string }) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [shopProducts, setShopProducts] = useState<ShopProduct[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>(
    ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => ({ day, shops: [] }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data from backend
  const refreshData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch products
      const productsResponse = await productsAPI.getProducts({ limit: 100 });
      let productsData: any[] = [];
      if (productsResponse.success) {
        productsData = productsResponse.data.map((p: any) => ({
          id: p.id,
          product_name: p.productName,
          unit: p.unit,
          status: p.status,
          created_date: p.createdAt,
          gst: p.gst,
          quantity: p.stocks?.[0]?.quantity || 0,
          rate: p.price || 0,  // Use price from products as rate
          hsn_code: p.hsnCode,
          price: p.price || 0,
          stockId: p.stocks?.[0]?.id || null,
        }));
      }

      // Fetch stocks and merge with products
      const stocksResponse = await stocksAPI.getStocks();
      if (stocksResponse.success) {
        const stocksData = stocksResponse.data;
        productsData = productsData.map(product => {
          const stock = stocksData.find((s: any) => s.productId === product.id);
          if (stock) {
            return {
              ...product,
              quantity: stock.quantity,
              stockId: stock.id,
            };
          }
          return product;
        });
      }

      setProducts(productsData);

      // Fetch shops first
      const shopsResponse = await shopsAPI.getShops({ limit: 100 });
      let fetchedShops: any[] = [];
      if (shopsResponse.success) {
        fetchedShops = shopsResponse.data.map((shop: any) => ({
          id: shop.id,
          shop_name: shop.shopName,
          address: shop.address,
          contact: shop.contact,
          email: shop.email,
          gst: shop.gstNumber,
          status: shop.status.toLowerCase(),
          created_date: new Date(shop.createdAt).toISOString().split('T')[0],
        }));
        setShops(fetchedShops);
      }

      // Fetch schedules and populate with shop data
      const schedulesResponse = await schedulesAPI.getSchedules();
      if (schedulesResponse.success) {
        const scheduleData = schedulesResponse.data;
        const weeklyScheduleData: DaySchedule[] = [
          { day: 'Monday', shops: scheduleData.MONDAY?.map((s: any) => {
            const shop = fetchedShops.find((shop: any) => shop.id === s.shop?.id);
            return shop || s.shop;
          }).filter(Boolean) || [] },
          { day: 'Tuesday', shops: scheduleData.TUESDAY?.map((s: any) => {
            const shop = fetchedShops.find((shop: any) => shop.id === s.shop?.id);
            return shop || s.shop;
          }).filter(Boolean) || [] },
          { day: 'Wednesday', shops: scheduleData.WEDNESDAY?.map((s: any) => {
            const shop = fetchedShops.find((shop: any) => shop.id === s.shop?.id);
            return shop || s.shop;
          }).filter(Boolean) || [] },
          { day: 'Thursday', shops: scheduleData.THURSDAY?.map((s: any) => {
            const shop = fetchedShops.find((shop: any) => shop.id === s.shop?.id);
            return shop || s.shop;
          }).filter(Boolean) || [] },
          { day: 'Friday', shops: scheduleData.FRIDAY?.map((s: any) => {
            const shop = fetchedShops.find((shop: any) => shop.id === s.shop?.id);
            return shop || s.shop;
          }).filter(Boolean) || [] },
          { day: 'Saturday', shops: scheduleData.SATURDAY?.map((s: any) => {
            const shop = fetchedShops.find((shop: any) => shop.id === s.shop?.id);
            return shop || s.shop;
          }).filter(Boolean) || [] },
        ];
        setWeeklySchedule(weeklyScheduleData);
      }

      // Fetch bills
      const billsResponse = await billsAPI.getBills({ limit: 100 });
      if (billsResponse.success) {
        setBills(billsResponse.data.map((b: any) => ({
          id: b.id.toString(),
          shop_id: b.shopId,
          shop_name: b.shop.shopName,
          bill_date: b.billDate,
          total_amount: b.totalAmount,
          received_amount: b.receivedAmount,
          pending_amount: b.pendingAmount,
          status: b.status,
          items: b.billItems.map((item: any) => ({
            product_id: item.productId,
            product_name: item.product.productName,
            quantity: item.quantity,
            price: item.rate,
            rate: item.rate,
            amount: item.amount,
            sgst: item.sgst,
            cgst: item.cgst,
            hsnCode: item.hsnCode,
          })),
        })));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const updateProductStock = (productId: number, quantity: number) => {
    setProducts(prevProducts =>
      prevProducts.map(product =>
        product.id === productId
          ? { ...product, quantity: Math.max(0, product.quantity - quantity) }
          : product
      )
    );
  };

  const addBill = async (bill: Bill) => {
    try {
      // Transform bill data for API
      const apiBillData = {
        shopId: bill.shop_id,
        billDate: bill.bill_date,
        receivedAmount: bill.received_amount,
        notes: '',
        items: bill.items.map(item => ({
          productId: item.product_id,
          quantity: item.quantity,
          rate: item.price,
          sgst: item.sgst !== undefined ? item.sgst : 0,
          cgst: item.cgst !== undefined ? item.cgst : 0,
          hsnCode: item.hsnCode,
        })),
      };

      const response = await billsAPI.createBill(apiBillData);

      if (response.success) {
        // Add the created bill to local state
        const newBill = {
          ...bill,
          id: response.data.id.toString(),
        };
        setBills(prevBills => [...prevBills, newBill]);

        // Update stock for sold items
        bill.items
          .filter(item => item.quantity > 0)
          .forEach(item => {
            updateProductStock(item.product_id, item.quantity);
          });
      } else {
        throw new Error(response.message || 'Failed to create bill');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add bill');
      throw err;
    }
  };

  const updateBill = async (id: string, updateData: { receivedAmount?: number; notes?: string }) => {
    try {
      const response = await billsAPI.updateBill(parseInt(id), updateData);
      if (response.success) {
        // Use the full updated bill from backend response which includes recalculated pending_amount and status
        const updatedBill = response.data;
        setBills(prevBills =>
          prevBills.map(bill =>
            bill.id === id ? {
              ...bill,
              received_amount: updatedBill.receivedAmount,
              pending_amount: updatedBill.pendingAmount,
              status: updatedBill.status,
              ...updateData // in case there are other fields like notes
            } : bill
          )
        );
      } else {
        throw new Error(response.message || 'Failed to update bill');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update bill');
      throw err;
    }
  };

  const deleteBill = async (id: string) => {
    try {
      const response = await billsAPI.deleteBill(parseInt(id));
      if (response.success) {
        setBills(prevBills => prevBills.filter(bill => bill.id !== id));
      } else {
        throw new Error(response.message || 'Failed to delete bill');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete bill');
      throw err;
    }
  };

  const value: AppContextType = {
    products,
    setProducts,
    shopProducts,
    setShopProducts,
    shops,
    setShops,
    bills,
    setBills,
    weeklySchedule,
    setWeeklySchedule,
    updateProductStock,
    addBill,
    updateBill,
    deleteBill,
    loading,
    error,
    refreshData,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};
