const API_BASE_URL = 'http://localhost:3001/api';

// Helper function to get auth token
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Helper function to make authenticated requests
const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<any> => {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  headers.set('Content-Type', 'application/json');

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API request failed');
  }

  return data;
};

// Auth API
export const authAPI = {
  login: async (credentials: { username: string; password: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Login failed');
    }

    // Store token
    if (data.success && data.data.token) {
      localStorage.setItem('authToken', data.data.token);
    }

    return data;
  },

  register: async (userData: { name: string; username: string; email: string; password: string; role?: string }) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    // Store token
    if (data.success && data.data.token) {
      localStorage.setItem('authToken', data.data.token);
    }

    return data;
  },

  verify: async () => {
    return authenticatedFetch(`${API_BASE_URL}/auth/verify`);
  },

  logout: () => {
    localStorage.removeItem('authToken');
  },
};

// Bills API
export const billsAPI = {
  getBills: async (params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    return authenticatedFetch(`${API_BASE_URL}/bills?${queryParams}`);
  },

  getBill: async (id: number) => {
    return authenticatedFetch(`${API_BASE_URL}/bills/${id}`);
  },

  createBill: async (billData: {
    shopId: number;
    billDate?: string;
    receivedAmount?: number;
    notes?: string;
    items: Array<{ productId: number; quantity: number; rate: number }>;
  }) => {
    return authenticatedFetch(`${API_BASE_URL}/bills`, {
      method: 'POST',
      body: JSON.stringify(billData),
    });
  },

  updateBill: async (id: number, billData: { receivedAmount?: number; notes?: string }) => {
    return authenticatedFetch(`${API_BASE_URL}/bills/${id}`, {
      method: 'PUT',
      body: JSON.stringify(billData),
    });
  },

  deleteBill: async (id: number) => {
    return authenticatedFetch(`${API_BASE_URL}/bills/${id}`, {
      method: 'DELETE',
    });
  },

  getBillsByShop: async (shopId: number, params?: { page?: number; limit?: number }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    return authenticatedFetch(`${API_BASE_URL}/bills/shop/${shopId}?${queryParams}`);
  },

  getPendingBills: async () => {
    return authenticatedFetch(`${API_BASE_URL}/bills/status/pending`);
  },
};

// Products API
export const productsAPI = {
  getProducts: async (params?: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, typeof value === 'number' ? value.toString() : value);
      });
    }
    return authenticatedFetch(`${API_BASE_URL}/products?${queryParams}`);
  },

  getProduct: async (id: number) => {
    return authenticatedFetch(`${API_BASE_URL}/products/${id}`);
  },

  createProduct: async (productData: {
    productName: string;
    unit: string;
    hsnCode: string;
    gst?: number;
    status?: string;
  }) => {
    return authenticatedFetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      body: JSON.stringify(productData),
    });
  },

  updateProduct: async (id: number, productData: {
    productName?: string;
    unit?: string;
    hsnCode?: string;
    gst?: number;
    status?: string;
    price?: number;
  }) => {
    return authenticatedFetch(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    });
  },

  deleteProduct: async (id: number) => {
    return authenticatedFetch(`${API_BASE_URL}/products/${id}`, {
      method: 'DELETE',
    });
  },

  createShopProduct: async (shopProductData: { shopId: number; productId: number; price: number }) => {
    return authenticatedFetch(`${API_BASE_URL}/products/shop-pricing`, {
      method: 'POST',
      body: JSON.stringify(shopProductData),
    });
  },

  updateShopProduct: async (id: number, shopProductData: { price: number }) => {
    return authenticatedFetch(`${API_BASE_URL}/products/shop-pricing/${id}`, {
      method: 'PUT',
      body: JSON.stringify(shopProductData),
    });
  },

  deleteShopProduct: async (id: number) => {
    return authenticatedFetch(`${API_BASE_URL}/products/shop-pricing/${id}`, {
      method: 'DELETE',
    });
  },
};

// Shops API (assuming similar structure based on schema)
export const shopsAPI = {
  getShops: async (params?: { page?: number; limit?: number; search?: string }) => {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, value.toString());
      });
    }
    return authenticatedFetch(`${API_BASE_URL}/shops?${queryParams}`);
  },

  getShop: async (id: number) => {
    return authenticatedFetch(`${API_BASE_URL}/shops/${id}`);
  },

  createShop: async (shopData: {
    shopName: string;
    address: string;
    contact: string;
    email?: string;
    gstNumber?: string;
  }) => {
    return authenticatedFetch(`${API_BASE_URL}/shops`, {
      method: 'POST',
      body: JSON.stringify(shopData),
    });
  },

  updateShop: async (id: number, shopData: {
    shopName?: string;
    address?: string;
    contact?: string;
    email?: string;
    gstNumber?: string;
    status?: string;
  }) => {
    return authenticatedFetch(`${API_BASE_URL}/shops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(shopData),
    });
  },

  deleteShop: async (id: number) => {
    return authenticatedFetch(`${API_BASE_URL}/shops/${id}`, {
      method: 'DELETE',
    });
  },

  getShopProducts: async (shopId: number) => {
    return authenticatedFetch(`${API_BASE_URL}/shops/${shopId}/products`);
  },
};

// Stocks API
export const stocksAPI = {
  getStocks: async () => {
    return authenticatedFetch(`${API_BASE_URL}/stocks`);
  },

  createStock: async (stockData: { productId: number; quantity: number; rate?: number }) => {
    return authenticatedFetch(`${API_BASE_URL}/stocks`, {
      method: 'POST',
      body: JSON.stringify(stockData),
    });
  },

  updateStock: async (stockId: number, stockData: { quantity: number; rate?: number }) => {
    return authenticatedFetch(`${API_BASE_URL}/stocks/${stockId}`, {
      method: 'PUT',
      body: JSON.stringify(stockData),
    });
  },
};

// Schedules API
export const schedulesAPI = {
  getSchedules: async () => {
    return authenticatedFetch(`${API_BASE_URL}/schedules`);
  },

  createSchedule: async (scheduleData: { shopId: number; dayOfWeek: string }) => {
    return authenticatedFetch(`${API_BASE_URL}/schedules`, {
      method: 'POST',
      body: JSON.stringify(scheduleData),
    });
  },

  deleteSchedule: async (id: number) => {
    return authenticatedFetch(`${API_BASE_URL}/schedules/${id}`, {
      method: 'DELETE',
    });
  },
};

// Dashboard API
export const dashboardAPI = {
  getDashboard: async () => {
    return authenticatedFetch(`${API_BASE_URL}/dashboard`);
  },
};
