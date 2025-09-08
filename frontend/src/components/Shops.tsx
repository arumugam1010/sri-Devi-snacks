import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Phone, MapPin, Store, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { shopsAPI, schedulesAPI } from '../services/api';
import type { DaySchedule } from '../context/AppContext';

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

const Shops: React.FC = () => {
  const { weeklySchedule, setWeeklySchedule } = useAppContext();

  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'shops' | 'schedule'>('shops');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showShopSelector, setShowShopSelector] = useState(false);
  const [showDayDetails, setShowDayDetails] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingShop, setEditingShop] = useState<Shop | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    shop_name: '',
    address: '',
    contact: '',
    email: '',
    gst: '',
    status: 'active' as 'active' | 'inactive'
  });

  // Fetch shops and schedules data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch shops
        const shopsResponse = await shopsAPI.getShops({ limit: 100 });
        if (shopsResponse.success) {
          const fetchedShops: Shop[] = shopsResponse.data.map((shop: any) => ({
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

          // Fetch existing schedules
          const schedulesResponse = await schedulesAPI.getSchedules();
          if (schedulesResponse.success) {
            // Transform backend schedules to frontend format
            const scheduleMap: { [key: string]: Shop[] } = {
              Monday: [],
              Tuesday: [],
              Wednesday: [],
              Thursday: [],
              Friday: [],
              Saturday: []
            };

            // Backend returns schedules grouped by day, so we need to iterate through each day
            Object.entries(schedulesResponse.data).forEach(([dayKey, daySchedules]: [string, any]) => {
              if (Array.isArray(daySchedules)) {
                // Convert backend uppercase day format to frontend title case
                const day = dayKey.charAt(0).toUpperCase() + dayKey.slice(1).toLowerCase();

                daySchedules.forEach((schedule: any) => {
                  const shop = fetchedShops.find((s: any) => s.id === schedule.shop?.id);
                  if (shop && scheduleMap[day]) {
                    scheduleMap[day].push({
                      id: shop.id,
                      shop_name: shop.shop_name,
                      address: shop.address,
                      contact: shop.contact,
                      email: shop.email,
                      gst: shop.gst,
                      status: shop.status,
                      created_date: shop.created_date,
                    });
                  }
                });
              }
            });

            // Convert to DaySchedule format
            const formattedSchedules = Object.entries(scheduleMap).map(([day, shops]) => ({
              day,
              shops
            }));

            setWeeklySchedule(formattedSchedules);
          }
        } else {
          alert('Failed to load shops data');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        alert('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredShops = shops.filter(shop =>
    shop.shop_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shop.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    shop.contact.includes(searchTerm)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingShop) {
        // Update existing shop via API
        const updatedShopResponse = await shopsAPI.updateShop(editingShop.id, {
          shopName: formData.shop_name,
          address: formData.address,
          contact: formData.contact,
          email: formData.email,
          gstNumber: formData.gst,
          status: formData.status.toUpperCase(),
        });

        if (updatedShopResponse.success) {
          setShops(shops.map(shop =>
            shop.id === editingShop.id
              ? {
                  ...shop,
                  ...formData,
                }
              : shop
          ));
          resetForm();
        } else {
          alert(updatedShopResponse.message || 'Failed to update shop');
        }
      } else {
        // Add new shop via API
        const newShopResponse = await shopsAPI.createShop({
          shopName: formData.shop_name,
          address: formData.address,
          contact: formData.contact,
          email: formData.email,
          gstNumber: formData.gst,
        });

        if (newShopResponse.success) {
          const createdShop = newShopResponse.data;
          const newShop: Shop = {
            id: createdShop.id,
            shop_name: createdShop.shopName,
            address: createdShop.address,
            contact: createdShop.contact,
            email: createdShop.email,
            gst: createdShop.gstNumber,
            status: createdShop.status.toLowerCase(),
            created_date: new Date(createdShop.createdAt).toISOString().split('T')[0],
          };
          setShops([...shops, newShop]);
          resetForm();
        } else {
          alert(newShopResponse.message || 'Failed to create shop');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error saving shop');
    }
  };

  const resetForm = () => {
    setFormData({
      shop_name: '',
      address: '',
      contact: '',
      email: '',
      gst: '',
      status: 'active'
    });
    setEditingShop(null);
    setShowModal(false);
  };

  const handleEdit = (shop: Shop) => {
    setEditingShop(shop);
    setFormData({
      shop_name: shop.shop_name,
      address: shop.address,
      contact: shop.contact,
      email: shop.email || '',
      gst: shop.gst || '',
      status: shop.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this shop?')) {
      try {
        const response = await shopsAPI.deleteShop(id);
        if (response.success) {
          setShops(shops.filter(shop => shop.id !== id));
        } else {
          alert(response.message || 'Failed to delete shop');
        }
      } catch (err: any) {
        alert(err.message || 'Error deleting shop');
      }
    }
  };

  // Schedule management functions
  const getShopsForDay = (day: string) => {
    const daySchedule = weeklySchedule.find(d => d.day === day);
    return daySchedule ? daySchedule.shops : [];
  };

  const getAvailableShops = (day: string) => {
    // Get shops that are not assigned to ANY day and are active
    const allAssignedShops = weeklySchedule.reduce((acc, daySchedule) =>
      [...acc, ...daySchedule.shops], [] as Shop[]);
    return shops.filter(shop =>
      shop.status === 'active' && !allAssignedShops.some(s => s.id === shop.id)
    );
  };

  const assignShopToDay = async (day: string, shop: Shop) => {
    try {
      // Create schedule entry in backend
      const response = await schedulesAPI.createSchedule({
        shopId: shop.id,
        dayOfWeek: day.toUpperCase()
      });

      if (response.success) {
        // First remove the shop from any other day it might be assigned to
        const scheduleWithoutShop = weeklySchedule.map(daySchedule => ({
          ...daySchedule,
          shops: daySchedule.shops.filter(s => s.id !== shop.id)
        }));

        // Then add the shop to the selected day
        const updatedSchedule = scheduleWithoutShop.map(daySchedule =>
          daySchedule.day === day
            ? { ...daySchedule, shops: [...daySchedule.shops, shop] }
            : daySchedule
        );

        setWeeklySchedule(updatedSchedule);
        setShowShopSelector(false); // Close the modal after successful assignment
      } else {
        alert(response.message || 'Failed to assign shop to schedule');
      }
    } catch (err: any) {
      alert(err.message || 'Error assigning shop to schedule');
    }
  };

  const removeShopFromDay = async (day: string, shopId: number) => {
    try {
      // First, find the schedule ID by fetching all schedules and finding the matching one
      const schedulesResponse = await schedulesAPI.getSchedules();
      if (schedulesResponse.success) {
        // Backend returns schedules grouped by day, so we need to flatten them
        const schedulesArray: any[] = [];
        Object.entries(schedulesResponse.data).forEach(([dayKey, daySchedules]: [string, any]) => {
          if (Array.isArray(daySchedules)) {
            daySchedules.forEach((schedule: any) => {
              schedulesArray.push({
                ...schedule,
                dayOfWeek: dayKey
              });
            });
          }
        });

        const scheduleToDelete = schedulesArray.find(
          (schedule: any) => schedule.shop?.id === shopId && schedule.dayOfWeek === day.toUpperCase()
        );

        if (scheduleToDelete) {
          // Delete schedule entry from backend using the correct schedule ID
          const response = await schedulesAPI.deleteSchedule(scheduleToDelete.id);

          if (response.success) {
            const updatedSchedule = weeklySchedule.map(daySchedule =>
              daySchedule.day === day
                ? { ...daySchedule, shops: daySchedule.shops.filter(s => s.id !== shopId) }
                : daySchedule
            );
            setWeeklySchedule(updatedSchedule);
          } else {
            alert(response.message || 'Failed to remove shop from schedule');
          }
        } else {
          alert('Schedule not found');
        }
      } else {
        alert('Failed to fetch schedules');
      }
    } catch (err: any) {
      alert(err.message || 'Error removing shop from schedule');
    }
  };

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('shops')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'shops'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Shop Management
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'schedule'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Weekly Schedule
          </button>
        </nav>
      </div>

      {activeTab === 'shops' && (
        <>
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Shop Management</h2>
              <p className="text-gray-600 mt-1">Manage your delivery shops and their information</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Shop
            </button>
          </div>

          {/* Search and Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  placeholder="Search shops..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{shops.length}</div>
              <div className="text-sm text-blue-800">Total Shops</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{shops.filter(s => s.status === 'active').length}</div>
              <div className="text-sm text-green-800">Active Shops</div>
            </div>
          </div>

          {/* Shops Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading shops...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Shop Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredShops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <Store className="h-6 w-6 text-blue-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{shop.shop_name}</div>
                            <div className="text-sm text-gray-500 flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              {shop.address}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 flex items-center mb-1">
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          {shop.contact}
                        </div>
                        {shop.email && (
                          <div className="text-sm text-gray-500">{shop.email}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          shop.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {shop.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(shop.created_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(shop)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded transition"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(shop.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Modal */}
          {showModal && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
                <div className="mt-3">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {editingShop ? 'Edit Shop' : 'Add New Shop'}
                  </h3>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Shop Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.shop_name}
                        onChange={(e) => setFormData({ ...formData, shop_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address *
                      </label>
                      <textarea
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Contact Number *
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.contact}
                        onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        GST No (Optional)
                      </label>
                      <input
                        type="text"
                        value={formData.gst}
                        onChange={(e) => setFormData({ ...formData, gst: e.target.value })}
                        placeholder="e.g., 33AAAAA1234A1Z5"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      </div>
                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          type="button"
                          onClick={resetForm}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                        >
                          {editingShop ? 'Update' : 'Add'} Shop
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'schedule' && (
          <>
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Weekly Shop Schedule</h2>
              <button
                onClick={() => setShowShopSelector(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
              >
                <Plus className="h-5 w-5 mr-2" />
                Assign Shop to Day
              </button>
            </div>

            {/* Schedule Cards */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {daysOfWeek.map(day => {
                const dayShops = getShopsForDay(day);
                return (
                  <div 
                    key={day} 
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedDay(day);
                      setShowDayDetails(true);
                    }}
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="text-lg font-semibold text-gray-900">{day}</h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDay(day);
                          setShowShopSelector(true);
                        }}
                        className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Assign
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {dayShops.length === 0 ? (
                        <p className="text-gray-400 text-sm italic">No shops assigned</p>
                      ) : (
                        dayShops.map(shop => (
                          <div key={shop.id} className="flex justify-between items-center bg-blue-50 rounded-lg px-3 py-2">
                            <span className="text-sm font-medium text-blue-800">{shop.shop_name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeShopFromDay(day, shop.id);
                              }}
                              className="text-red-600 hover:text-red-800 focus:outline-none"
                              aria-label={`Remove ${shop.shop_name} from ${day}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="mt-3 text-xs text-gray-500">
                      {dayShops.length} shop{dayShops.length !== 1 ? 's' : ''} assigned
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Assign Shop Modal */}
            {showShopSelector && selectedDay && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
                  <div className="mt-3">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">
                      Assign Shop to {selectedDay}
                    </h3>
                    <div>
                      {getAvailableShops(selectedDay).length === 0 ? (
                        <p className="text-sm text-gray-600">No available shops to assign for {selectedDay}.</p>
                      ) : (
                        getAvailableShops(selectedDay).map(shop => (
                          <div key={shop.id} className="flex justify-between items-center mb-2">
                            <span>{shop.shop_name}</span>
                            <button
                              onClick={() => {
                                assignShopToDay(selectedDay, shop);
                                setShowShopSelector(false);
                              }}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Assign
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => setShowShopSelector(false)}
                        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {/* Day Details Modal */}
          {showDayDetails && selectedDay && (
            <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
              <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-lg bg-white">
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      Shops Assigned to {selectedDay}
                    </h3>
                    <button
                      onClick={() => setShowDayDetails(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <span className="sr-only">Close</span>
                      ×
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {getShopsForDay(selectedDay).length === 0 ? (
                      <p className="text-gray-400 text-sm italic">No shops assigned to {selectedDay}</p>
                    ) : (
                      getShopsForDay(selectedDay).map(shop => (
                        <div key={shop.id} className="flex justify-between items-center bg-blue-50 rounded-lg p-4">
                          <div className="flex-1">
                            <h4 className="font-medium text-blue-900">{shop.shop_name}</h4>
                            <p className="text-sm text-blue-700">{shop.address}</p>
                            <p className="text-sm text-blue-600">{shop.contact}</p>
                            {shop.email && (
                              <p className="text-sm text-blue-500">{shop.email}</p>
                            )}
                          </div>
                          <button
                            onClick={() => removeShopFromDay(selectedDay, shop.id)}
                            className="ml-4 text-red-600 hover:text-red-800 focus:outline-none p-2"
                            aria-label={`Remove ${shop.shop_name} from ${selectedDay}`}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  
                  <div className="mt-6 flex justify-end">
                    <button
                      onClick={() => setShowDayDetails(false)}
                      className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Shops;
