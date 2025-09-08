import React, { useState } from 'react';
import { Calendar, Plus, Store, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface Shop {
  id: number;
  shop_name: string;
  address: string;
  contact: string;
  email?: string;
  status: 'active' | 'inactive';
  created_date: string;
}

interface DaySchedule {
  day: string;
  shops: Shop[];
}

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const WeeklySchedule: React.FC = () => {
  const { weeklySchedule, setWeeklySchedule } = useAppContext();
  
  // Mock shops data (in real app, this would come from shops management)
  const allShops: Shop[] = [
    {
      id: 1,
      shop_name: "Metro Store",
      address: "123 Main Street, Downtown",
      contact: "+91 9876543210",
      email: "metro@store.com",
      status: "active",
      created_date: "2024-01-15"
    },
    {
      id: 2,
      shop_name: "Quick Mart",
      address: "456 Oak Avenue, Central",
      contact: "+91 9876543211",
      email: "quick@mart.com",
      status: "active",
      created_date: "2024-01-20"
    },
    {
      id: 3,
      shop_name: "City Shop",
      address: "789 Pine Road, North",
      contact: "+91 9876543212",
      email: "city@shop.com",
      status: "active",
      created_date: "2024-02-01"
    }
  ];

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showShopSelector, setShowShopSelector] = useState(false);

  // Get shops that are not assigned to any day
  const availableShops = allShops.filter(shop => 
    !weeklySchedule.some(daySchedule => 
      daySchedule.shops.some(assignedShop => assignedShop.id === shop.id)
    )
  );

  const assignShopToDay = (shopId: number, day: string) => {
    const shop = allShops.find(s => s.id === shopId);
    if (!shop) return;

    // Remove shop from any existing day assignment
    const updatedSchedule = weeklySchedule.map(daySchedule => ({
      ...daySchedule,
      shops: daySchedule.shops.filter(s => s.id !== shopId)
    }));

    // Add shop to the selected day
    const finalSchedule = updatedSchedule.map(daySchedule => 
      daySchedule.day === day
        ? { ...daySchedule, shops: [...daySchedule.shops, shop] }
        : daySchedule
    );

    setWeeklySchedule(finalSchedule);
    setShowShopSelector(false);
  };

  const removeShopFromDay = (shopId: number, day: string) => {
    const updatedSchedule = weeklySchedule.map(daySchedule => 
      daySchedule.day === day
        ? { ...daySchedule, shops: daySchedule.shops.filter(s => s.id !== shopId) }
        : daySchedule
    );
    setWeeklySchedule(updatedSchedule);
  };

  const DayCard: React.FC<DaySchedule> = ({ day, shops }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{day}</h3>
        <button
          onClick={() => {
            setSelectedDay(day);
            setShowShopSelector(true);
          }}
          className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Shop
        </button>
      </div>
      
      {shops.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Store className="h-12 w-12 mx-auto mb-2 text-gray-300" />
          <p>No shops assigned</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shops.map(shop => (
            <div key={shop.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium text-gray-900">{shop.shop_name}</div>
                <div className="text-sm text-gray-500">{shop.contact}</div>
              </div>
              <button
                onClick={() => removeShopFromDay(shop.id, day)}
                className="text-red-600 hover:text-red-800 p-1 rounded transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Weekly Shop Schedule</h2>
          <p className="text-gray-600 mt-1">Assign shops to specific days of the week</p>
        </div>
        <div className="flex items-center text-blue-600">
          <Calendar className="h-6 w-6 mr-2" />
          <span className="font-medium">Weekly View</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{allShops.length}</div>
          <div className="text-sm text-blue-800">Total Shops</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {weeklySchedule.reduce((total, day) => total + day.shops.length, 0)}
          </div>
          <div className="text-sm text-green-800">Assigned Shops</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">{availableShops.length}</div>
          <div className="text-sm text-orange-800">Available Shops</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {allShops.length - weeklySchedule.reduce((total, day) => total + day.shops.length, 0)}
          </div>
          <div className="text-sm text-purple-800">Unassigned Shops</div>
        </div>
      </div>

      {/* Weekly Schedule Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {weeklySchedule.map(daySchedule => (
          <DayCard key={daySchedule.day} {...daySchedule} />
        ))}
      </div>

      {/* Shop Selector Modal */}
      {showShopSelector && selectedDay && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Add Shop to {selectedDay}
                </h3>
                <button
                  onClick={() => setShowShopSelector(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {availableShops.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Store className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p>No shops available to assign</p>
                  <p className="text-sm">All shops are already assigned to days</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {availableShops.map(shop => (
                    <div
                      key={shop.id}
                      onClick={() => assignShopToDay(shop.id, selectedDay)}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 cursor-pointer transition"
                    >
                      <div className="font-medium text-gray-900">{shop.shop_name}</div>
                      <div className="text-sm text-gray-500">{shop.contact}</div>
                      <div className="text-xs text-gray-400">{shop.address}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklySchedule;
