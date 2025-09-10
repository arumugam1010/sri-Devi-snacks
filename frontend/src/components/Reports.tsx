import React, { useState, useMemo } from 'react';
import { Calendar, Download, TrendingUp, DollarSign, Package, ShoppingCart, BarChart3, Filter, CalendarRange } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const Reports: React.FC = () => {
  const { bills, products, shops } = useAppContext();
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'shops' | 'returns' | 'products'>('daily');

  // Helper functions for weekly reports
  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  const getStartOfWeek = (date: Date): Date => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const getEndOfWeek = (date: Date): Date => {
    const startOfWeek = getStartOfWeek(date);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return endOfWeek;
  };

  // Updated handleExport to support new report types
  const handleExport = (reportType: string) => {
    let dataToExport = [];
    switch(reportType) {
      case 'daily-summary':
        dataToExport = dailyBillingSummary;
        break;
      case 'weekly-summary':
        dataToExport = weeklyBillingSummary;
        break;
      case 'monthly-summary':
        dataToExport = monthlyBillingSummary;
        break;
      case 'shop-performance':
        dataToExport = shopWiseReport;
        break;
      case 'returns-history':
        dataToExport = returnHistory;
        break;
      case 'product-performance':
        dataToExport = productPerformance;
        break;
      default:
        alert('Unknown report type');
        return;
    }
    // Convert dataToExport to CSV and trigger download
    exportToCSV(dataToExport, reportType);
  };

  // Helper function to convert JSON to CSV and trigger download
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      alert('No data to export');
      return;
    }
    const csvRows = [];
    const headers = Object.keys(data[0]);
    csvRows.push(headers.join(','));

    for (const row of data) {
      const values = headers.map(header => {
        const escaped = ('' + row[header]).replace(/"/g, '\\"');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const [dateFilter, setDateFilter] = useState({
    from: '2024-01-01',
    to: new Date().toISOString().split('T')[0]
  });


  
  // Generate reports from actual data
  const dailyBillingSummary = useMemo(() => {
    const billsByDate = bills.reduce((acc, bill) => {
      const date = bill.bill_date;
      if (!acc[date]) {
        acc[date] = { date, bills: 0, revenue: 0, received: 0, pending: 0, shops: new Set() };
      }
      acc[date].bills += 1;
      acc[date].revenue += bill.total_amount;
      acc[date].received += bill.received_amount;
      acc[date].pending += bill.pending_amount;
      acc[date].shops.add(bill.shop_id);
      return acc;
    }, {} as Record<string, { date: string; bills: number; revenue: number; received: number; pending: number; shops: Set<number> }>);

    return Object.values(billsByDate)
      .map(item => ({
        date: item.date,
        bills: item.bills,
        revenue: item.revenue,
        received: item.received,
        pending: item.pending,
        shops: item.shops.size
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10); // Show last 10 days
  }, [bills]);

  const shopWiseReport = useMemo(() => {
    const shopStats = bills.reduce((acc, bill) => {
      if (!acc[bill.shop_id]) {
        acc[bill.shop_id] = {
          shop_name: bill.shop_name,
          bills: 0,
          total_amount: 0,
          last_order: bill.bill_date
        };
      }
      acc[bill.shop_id].bills += 1;
      acc[bill.shop_id].total_amount += bill.total_amount;
      if (new Date(bill.bill_date) > new Date(acc[bill.shop_id].last_order)) {
        acc[bill.shop_id].last_order = bill.bill_date;
      }
      return acc;
    }, {} as Record<number, { shop_name: string; bills: number; total_amount: number; last_order: string }>);

    return Object.values(shopStats).map(shop => ({
      ...shop,
      avg_bill: Math.round(shop.total_amount / shop.bills)
    }));
  }, [bills]);

  const returnHistory = useMemo(() => {
    return (bills as any[]).flatMap((bill: any) => 
      bill.items
        .filter((item: any) => item.quantity < 0)
        .map((item: any) => ({
          return_date: bill.bill_date,
          shop_name: bill.shop_name,
          product_name: item.product_name,
          quantity: Math.abs(item.quantity),
          amount: Math.abs(item.amount),
          reason: 'Return processed'
        }))
    );
  }, [bills]);

  // Weekly report generation
  const weeklyBillingSummary = useMemo(() => {
    const billsByWeek = bills.reduce((acc, bill) => {
      const date = new Date(bill.bill_date);
      const year = date.getFullYear();
      const weekNumber = getWeekNumber(date);
      const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
      
      if (!acc[weekKey]) {
        acc[weekKey] = { 
          week: weekKey, 
          startDate: getStartOfWeek(date),
          endDate: getEndOfWeek(date),
          bills: 0, 
          revenue: 0, 
          received: 0, 
          pending: 0, 
          shops: new Set<number>() 
        };
      }
      acc[weekKey].bills += 1;
      acc[weekKey].revenue += bill.total_amount;
      acc[weekKey].received += bill.received_amount;
      acc[weekKey].pending += bill.pending_amount;
      acc[weekKey].shops.add(bill.shop_id);
      return acc;
    }, {} as Record<string, { week: string; startDate: Date; endDate: Date; bills: number; revenue: number; received: number; pending: number; shops: Set<number> }>);

    return Object.values(billsByWeek)
      .map(item => ({
        week: item.week,
        startDate: item.startDate,
        endDate: item.endDate,
        bills: item.bills,
        revenue: item.revenue,
        received: item.received,
        pending: item.pending,
        shops: item.shops.size
      }))
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .slice(0, 12); // Show last 12 weeks
  }, [bills]);

  // Monthly report generation
  const monthlyBillingSummary = useMemo(() => {
    const billsByMonth = bills.reduce((acc, bill) => {
      const date = new Date(bill.bill_date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      
      if (!acc[monthKey]) {
        acc[monthKey] = { 
          month: monthKey, 
          monthName: date.toLocaleString('default', { month: 'long' }),
          year: year,
          bills: 0, 
          revenue: 0, 
          received: 0, 
          pending: 0, 
          shops: new Set<number>() 
        };
      }
      acc[monthKey].bills += 1;
      acc[monthKey].revenue += bill.total_amount;
      acc[monthKey].received += bill.received_amount;
      acc[monthKey].pending += bill.pending_amount;
      acc[monthKey].shops.add(bill.shop_id);
      return acc;
    }, {} as Record<string, { month: string; monthName: string; year: number; bills: number; revenue: number; received: number; pending: number; shops: Set<number> }>);

    return Object.values(billsByMonth)
      .map(item => ({
        month: item.month,
        monthName: item.monthName,
        year: item.year,
        bills: item.bills,
        revenue: item.revenue,
        received: item.received,
        pending: item.pending,
        shops: item.shops.size
      }))
      .sort((a, b) => new Date(`${b.month}-01`).getTime() - new Date(`${a.month}-01`).getTime())
      .slice(0, 12); // Show last 12 months
  }, [bills]);



  const productPerformance = useMemo(() => {
    const productStats = bills.reduce((acc, bill) => {
      bill.items.forEach(item => {
        if (!acc[item.product_id]) {
          acc[item.product_id] = {
            product_name: item.product_name,
            total_sold: 0,
            revenue: 0,
            returns: 0,
            shops: new Set()
          };
        }
        if (item.quantity > 0) {
          acc[item.product_id].total_sold += item.quantity;
          acc[item.product_id].revenue += item.amount + (item.sgst || 0) + (item.cgst || 0);
        } else {
          acc[item.product_id].returns += Math.abs(item.quantity);
        }
        acc[item.product_id].shops.add(bill.shop_id);
      });
      return acc;
    }, {} as Record<number, { product_name: string; total_sold: number; revenue: number; returns: number; shops: Set<number> }>);

    return Object.values(productStats).map(product => ({
      ...product,
      shops: product.shops.size
    }));
  }, [bills]);


  const StatCard = ({ title, value, icon: Icon, change, color = 'blue' }: any) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600">+{change}%</span>
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Reports & Analytics</h2>
          <p className="text-gray-600 mt-1">Track your business performance and insights</p>
        </div>
        <div className="flex space-x-3">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            <input
              type="date"
              value={dateFilter.from}
              onChange={(e) => setDateFilter({ ...dateFilter, from: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={dateFilter.to}
              onChange={(e) => setDateFilter({ ...dateFilter, to: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Revenue"
          value={`₹${bills.reduce((sum, bill) => sum + bill.total_amount, 0).toLocaleString()}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Total Bills"
          value={bills.length.toString()}
          icon={ShoppingCart}
          color="blue"
        />
        <StatCard
          title="Products Sold"
          value={bills.reduce((sum, bill) => sum + bill.items.filter(item => item.quantity > 0).reduce((itemSum, item) => itemSum + item.quantity, 0), 0).toLocaleString()}
          icon={Package}
          color="purple"
        />
        <StatCard
          title="Active Shops"
          value={shops.length.toString()}
          icon={TrendingUp}
          color="orange"
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'daily', label: 'Daily Summary', icon: BarChart3 },
            { key: 'weekly', label: 'Weekly Reports', icon: CalendarRange },
            { key: 'monthly', label: 'Monthly Reports', icon: Calendar },
            { key: 'shops', label: 'Shop Reports', icon: ShoppingCart },
            { key: 'returns', label: 'Returns', icon: Package },
            { key: 'products', label: 'Product Performance', icon: TrendingUp },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Daily Summary Tab */}
        {activeTab === 'daily' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Daily Billing Summary</h3>
              <button
                onClick={() => handleExport('daily-summary')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bills
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Received
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Pending
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shops Served
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg per Bill
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dailyBillingSummary.map((day) => (
                    <tr key={day.date} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(day.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {day.bills}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ₹{day.revenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        ₹{day.received.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                        ₹{day.pending.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {day.shops}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{Math.round(day.revenue / day.bills).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Weekly Reports Tab */}
        {activeTab === 'weekly' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Weekly Billing Summary</h3>
              <button
                onClick={() => handleExport('weekly-summary')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Week
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bills
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Received
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Pending
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shops Served
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg per Bill
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {weeklyBillingSummary.map((week) => (
                    <tr key={week.week} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {week.week}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {week.startDate.toLocaleDateString()} - {week.endDate.toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {week.bills}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ₹{week.revenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        ₹{week.received.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                        ₹{week.pending.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {week.shops}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{Math.round(week.revenue / week.bills).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Monthly Reports Tab */}
        {activeTab === 'monthly' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Monthly Billing Summary</h3>
              <button
                onClick={() => handleExport('monthly-summary')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Year
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Bills
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Received
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Pending
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shops Served
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg per Bill
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {monthlyBillingSummary.map((month) => (
                    <tr key={month.month} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {month.monthName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {month.year}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {month.bills}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ₹{month.revenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                        ₹{month.received.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-orange-600">
                        ₹{month.pending.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {month.shops}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{Math.round(month.revenue / month.bills).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Shop Reports Tab */}
        {activeTab === 'shops' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Shop-wise Performance</h3>
              <button
                onClick={() => handleExport('shop-performance')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shop Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Bills
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Bill Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Order
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {shopWiseReport.map((shop) => (
                    <tr key={shop.shop_name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{shop.shop_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {shop.bills}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ₹{shop.total_amount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ₹{shop.avg_bill.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(shop.last_order).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Returns Tab */}
        {activeTab === 'returns' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Return History</h3>
              <button
                onClick={() => handleExport('returns-history')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Return Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shop Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {returnHistory.map((returnItem: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(returnItem.return_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {returnItem.shop_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {returnItem.product_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {returnItem.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                        -₹{returnItem.amount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                          {returnItem.reason}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Product Performance Tab */}
        {activeTab === 'products' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Product Performance</h3>
              <button
                onClick={() => handleExport('product-performance')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Sold
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Returns
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shops
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Performance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {productPerformance.map((product) => (
                    <tr key={product.product_name} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.total_sold} units
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                        ₹{product.revenue.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">
                        {product.returns} units
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product.shops} shops
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-green-600 h-2 rounded-full"
                              style={{ width: `${Math.min(100, (product.revenue / 20000) * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {Math.round((product.revenue / 20000) * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;