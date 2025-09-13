import React, { useState, useEffect } from 'react';
import { Store, Package, Receipt, TrendingUp, DollarSign, Users, ShoppingCart, ArrowUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { dashboardAPI } from '../services/api';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { products, bills, shops } = useAppContext();

  // State for dashboard stats from backend
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Calculate stats from context data (for other stats not from backend)
  const totalProducts = products.length;
  const pendingBills = bills.filter(bill => bill.status === 'PENDING').length;

  const [stats, setStats] = useState({
    totalShops: shops.filter(shop => shop.status === 'active').length,
    totalProducts,
    todaysBills: 0,
    todaysRevenue: 0,
    pendingReturns: 0,
    activeOrders: pendingBills
  });

  // Fetch dashboard stats from backend
  useEffect(() => {
    const fetchDashboardStats = async () => {
      try {
        setLoading(true);
        const response = await dashboardAPI.getDashboard();
        if (response.success) {
          setDashboardStats(response.data);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardStats();
  }, []);

  // Update stats when context data or dashboard stats change
  useEffect(() => {
    setStats({
      totalShops: shops.filter(shop => shop.status === 'active').length,
      totalProducts: products.length,
      todaysBills: dashboardStats?.bills?.today || 0,
      todaysRevenue: dashboardStats?.revenue?.today || 0,
      pendingReturns: dashboardStats?.bills?.pending || 0,
      activeOrders: bills.filter(bill => bill.status === 'PENDING').length
    });
  }, [products, bills, shops, dashboardStats]);

  // Get recent bills with proper time formatting
  const recentBills = bills
    .sort((a, b) => new Date(b.bill_date).getTime() - new Date(a.bill_date).getTime())
    .slice(0, 4)
    .map(bill => {
      const billDate = new Date(bill.bill_date);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let time = 'Today';
      if (billDate.toDateString() === yesterday.toDateString()) {
        time = 'Yesterday';
      } else if (billDate < yesterday) {
        time = billDate.toLocaleDateString();
      }

      return {
        id: bill.id,
        shop: bill.shop_name,
        amount: bill.total_amount,
        time,
        status: bill.status
      };
    });

  // Calculate top shops based on real data
  const shopStats = shops.map(shop => {
    const shopBills = bills.filter(bill => bill.shop_id === shop.id);
    return {
      name: shop.shop_name,
      orders: shopBills.length,
      revenue: shopBills.reduce((sum, bill) => sum + bill.total_amount, 0)
    };
  });

  const topShops = shopStats
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);

  const StatCard = ({ title, value, icon: Icon, change, color = 'blue' }: any) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {/* {change && (
            <div className="flex items-center mt-2">
              <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+{change}%</span>
              <span className="text-sm text-gray-500 ml-1">from yesterday</span> 
            </div>
          )} */}
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          title="Total Shops"
          value={stats.totalShops}
          icon={Store}
          change={5.2}
          color="blue"
        />
        <StatCard
          title="Products"
          value={stats.totalProducts}
          icon={Package}
          change={2.1}
          color="green"
        />
        <StatCard
          title="Today's Bills"
          value={stats.todaysBills}
          icon={Receipt}
          change={12.5}
          color="purple"
        />
        <StatCard
          title="Today's Revenue"
          value={`₹${stats.todaysRevenue.toLocaleString()}`}
          icon={DollarSign}
          change={8.3}
          color="yellow"
        />
        <StatCard
          title="Pending Returns"
          value={stats.pendingReturns}
          icon={TrendingUp}
          color="red"
        />
        <StatCard
          title="Active Orders"
          value={stats.activeOrders}
          icon={ShoppingCart}
          change={15.2}
          color="indigo"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Additional dashboard content can be added here */}
      </div>
    </div>
  );
};

export default Dashboard;
