import React, { useState, useEffect } from 'react';
import { Store, Package, Receipt, TrendingUp, DollarSign, Users, ShoppingCart, ArrowUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { products, bills } = useAppContext();
  
  // Calculate stats from context data
  const totalProducts = products.length;
  const todaysBills = bills.filter(bill => bill.bill_date === new Date().toISOString().split('T')[0]).length;
  const todaysRevenue = bills
    .filter(bill => bill.bill_date === new Date().toISOString().split('T')[0])
    .reduce((sum, bill) => sum + bill.received_amount, 0);
  const pendingBills = bills.filter(bill => bill.status === 'pending').length;
  
  const [stats, setStats] = useState({
    totalShops: 3, // Mock shops count
    totalProducts,
    todaysBills,
    todaysRevenue,
    pendingReturns: 0, // Mock returns count
    activeOrders: pendingBills
  });

  // Update stats when context data changes
  useEffect(() => {
    setStats({
      totalShops: 3,
      totalProducts: products.length,
      todaysBills: bills.filter(bill => bill.bill_date === new Date().toISOString().split('T')[0]).length,
      todaysRevenue: bills
        .filter(bill => bill.bill_date === new Date().toISOString().split('T')[0])
        .reduce((sum, bill) => sum + bill.received_amount, 0),
      pendingReturns: 0,
      activeOrders: bills.filter(bill => bill.status === 'pending').length
    });
  }, [products, bills]);

  const recentBills = bills
    .slice(-4)
    .reverse()
    .map(bill => ({
      id: bill.id,
      shop: bill.shop_name,
      amount: bill.total_amount,
      time: 'Today', // Simplified time display
      status: bill.status
    }));

  const topShops = [
    { name: 'Metro Store', orders: 8, revenue: 4500 },
    { name: 'Quick Mart', orders: 6, revenue: 3200 },
    { name: 'City Shop', orders: 5, revenue: 2800 }
  ];

  const StatCard = ({ title, value, icon: Icon, change, color = 'blue' }: any) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              <ArrowUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+{change}%</span>
              <span className="text-sm text-gray-500 ml-1">from yesterday</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-full bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
    </div>
  );

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
