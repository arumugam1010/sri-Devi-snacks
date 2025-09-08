

import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Package, Tag, DollarSign, ArrowLeft, Store } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { productsAPI, shopsAPI } from '../services/api';

interface Product {
  id: number;
  product_name: string;
  unit: string;
  created_date: string;
  gst: number; // Added gst property
  hsn_code: string; // Added hsn_code property
  price: number; // Added price property
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

const Products: React.FC = () => {
  const { weeklySchedule, shopProducts, setShopProducts } = useAppContext();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);



  const [activeTab, setActiveTab] = useState<'products' | 'pricing'>('products');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedShop, setSelectedShop] = useState<number | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [priceEditValue, setPriceEditValue] = useState<string>('');


  // Fetch products data on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await productsAPI.getProducts({ limit: 100 });
          if (response.success) {
            const fetchedProducts: Product[] = response.data.map((product: any) => ({
              id: product.id,
              product_name: product.productName,
              unit: product.unit,
              created_date: new Date(product.createdAt).toISOString().split('T')[0],
              gst: product.gst,
              hsn_code: product.hsnCode,
              price: product.price || 0,
            }));
            setProducts(fetchedProducts);
          }
      } catch (error) {
        console.error('Error fetching products:', error);
        alert('Failed to load products data');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const [productForm, setProductForm] = useState({
    product_name: '',
    unit: 'kg',
    gst: 5, // default gst value
    hsn_code: '', // HSN code field
    price: 0 // Product price field
  });

  const filteredProducts = products.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.unit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingProduct) {
        // Update existing product via API
        const updatedProductResponse = await productsAPI.updateProduct(editingProduct.id, {
          productName: productForm.product_name,
          unit: productForm.unit,
          gst: productForm.gst,
          hsnCode: productForm.hsn_code,
          price: productForm.price,
        });

        if (updatedProductResponse.success) {
          setProducts(products.map(product =>
            product.id === editingProduct.id
              ? { ...product, ...productForm }
              : product
          ));
          resetProductForm();
        } else {
          alert(updatedProductResponse.message || 'Failed to update product');
        }
      } else {
        // Call API to create product
        // Transform form data to API expected format
        const apiProductData = {
          productName: productForm.product_name,
          unit: productForm.unit,
          gst: productForm.gst,
          hsnCode: productForm.hsn_code,
          price: productForm.price,
        };

        // Import productsAPI at top: import { productsAPI } from '../services/api';
        const response = await productsAPI.createProduct(apiProductData);

        if (response.success) {
          const createdProduct = response.data;
          const newProduct: Product = {
            id: createdProduct.id,
            product_name: createdProduct.productName,
            unit: createdProduct.unit,
            created_date: new Date(createdProduct.createdAt).toISOString().split('T')[0],
            gst: createdProduct.gst,
            hsn_code: createdProduct.hsnCode,
            price: createdProduct.price || 0,
          };
          setProducts([...products, newProduct]);
          resetProductForm();
        } else {
          alert(response.message || 'Failed to create product');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error creating product');
    }
  };

  const resetProductForm = () => {
    setProductForm({
      product_name: '',
      unit: 'kg',
      gst: 5, // default gst value
      hsn_code: '', // HSN code field
      price: 0 // Product price field
    });
    setEditingProduct(null);
    setShowModal(false);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      product_name: product.product_name,
      unit: product.unit,
      gst: product.gst,
      hsn_code: product.hsn_code,
      price: product.price
    });
    setShowModal(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (confirm('Are you sure you want to delete this product?')) {
      try {
        const response = await productsAPI.deleteProduct(id);
        if (response.success) {
          setProducts(products.filter(product => product.id !== id));
          setShopProducts(shopProducts.filter(sp => sp.product_id !== id));
        } else {
          alert(response.message || 'Failed to delete product');
        }
      } catch (err: any) {
        alert(err.message || 'Error deleting product');
      }
    }
  };

  const handleDaySelect = (day: string) => {
    setSelectedDay(day);
  };

  const allShops = React.useMemo((): Array<any> => {
    const shopSet = new Set<number>();
    const uniqueShops: Array<any> = [];
    weeklySchedule.forEach(day => {
      day.shops.forEach(shop => {
        if (!shopSet.has(shop.id)) {
          shopSet.add(shop.id);
          uniqueShops.push(shop);
        }
      });
    });
    return uniqueShops;
  }, [weeklySchedule]);

  const handleShopSelect = async (shopId: number) => {
    setSelectedShop(shopId);

    try {
      // Fetch existing shop products from backend
      const response = await shopsAPI.getShopProducts(shopId);
      if (response.success) {
        const fetchedShopProducts: ShopProduct[] = response.data.map((sp: any) => ({
          id: sp.id,
          shop_id: sp.shopId,
          product_id: sp.productId,
          price: sp.price,
          shop_name: sp.shop?.shopName || '',
          product_name: sp.product?.productName || '',
          unit: sp.product?.unit || '',
          gst: sp.product?.gst || 0,
          hsn_code: sp.product?.hsnCode || ''
        }));
        setShopProducts(fetchedShopProducts);
      } else {
        // If no shop products exist, initialize with all products at default prices
        const shop = allShops.find(s => s.id === shopId);
        if (!shop) return;

        const newShopProducts: ShopProduct[] = [];
        let maxId = Math.max(...shopProducts.map(sp => sp.id), 0);

        products.forEach(product => {
          const newShopProduct: ShopProduct = {
            id: ++maxId,
            shop_id: shopId,
            product_id: product.id,
            price: product.price || 0,
            shop_name: shop.shop_name,
            product_name: product.product_name,
            unit: product.unit,
            gst: product.gst,
            hsn_code: product.hsn_code
          };
          newShopProducts.push(newShopProduct);
        });

        setShopProducts(newShopProducts);
      }
    } catch (error) {
      console.error('Error fetching shop products:', error);
      alert('Failed to load shop products');
    }
  };

  const handleBackToDays = () => {
    setSelectedDay(null);
    setSelectedShop(null);
    setEditingPriceId(null);
  };

  const handleBackToShops = () => {
    setSelectedShop(null);
    setEditingPriceId(null);
  };

  const handlePriceEdit = (shopProduct: ShopProduct) => {
    setEditingPriceId(shopProduct.id);
    setPriceEditValue(shopProduct.price.toString());
  };

  const handlePriceSave = async (shopProductId: number) => {
    const price = parseFloat(priceEditValue);
    if (!isNaN(price)) {
      try {
        const response = await productsAPI.updateShopProduct(shopProductId, { price });
        if (response.success) {
          setShopProducts(shopProducts.map(sp =>
            sp.id === shopProductId
              ? { ...sp, price: price }
              : sp
          ));
        } else {
          alert(response.message || 'Failed to update price');
        }
      } catch (error) {
        console.error('Error updating price:', error);
        alert('Failed to update price');
      }
    }
    setEditingPriceId(null);
  };

  const handlePriceCancel = () => {
    setEditingPriceId(null);
  };

  const handleAddPricing = async (productId: number) => {
    if (!selectedShop) return;

    try {
      const response = await productsAPI.createShopProduct({
        shopId: selectedShop,
        productId: productId,
        price: 0
      });

      if (response.success) {
        // Refresh shop products
        const shopProductsResponse = await shopsAPI.getShopProducts(selectedShop);
        if (shopProductsResponse.success) {
          const fetchedShopProducts: ShopProduct[] = shopProductsResponse.data.map((sp: any) => ({
            id: sp.id,
            shop_id: sp.shopId,
            product_id: sp.productId,
            price: sp.price,
            shop_name: sp.shop?.shopName || '',
            product_name: sp.product?.productName || '',
            unit: sp.product?.unit || '',
            gst: sp.product?.gst || 0,
            hsn_code: sp.product?.hsnCode || ''
          }));
          setShopProducts(fetchedShopProducts);
        }
        setEditingPriceId(response.data.id);
        setPriceEditValue('0');
      } else {
        alert(response.message || 'Failed to add pricing');
      }
    } catch (error) {
      console.error('Error adding pricing:', error);
      alert('Failed to add pricing');
    }
  };

  const handleDeletePricing = async (id: number) => {
    if (confirm('Are you sure you want to delete this pricing?')) {
      try {
        const response = await productsAPI.deleteShopProduct(id);
        if (response.success) {
          setShopProducts(shopProducts.filter(sp => sp.id !== id));
        } else {
          alert(response.message || 'Failed to delete pricing');
        }
      } catch (error) {
        console.error('Error deleting pricing:', error);
        alert('Failed to delete pricing');
      }
    }
  };

  // Get products for selected shop
  const getShopProducts = () => {
    if (!selectedShop) return [];

    return products.map(product => {
      const existingPricing = shopProducts.find(sp =>
        sp.shop_id === selectedShop && sp.product_id === product.id
      );

      return {
        product,
        pricing: existingPricing
      };
    });
  };

  const shopProductsList = getShopProducts();
  const selectedShopData = allShops.find((s: any) => s.id === selectedShop);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Product Management</h2>
          <p className="text-gray-600 mt-1">Manage products and shop-specific pricing</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('products')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'products'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab('pricing')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'pricing'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Shop Pricing
          </button>
        </nav>
      </div>

      {/* Search and Add Button */}
      <div className="flex justify-between items-center">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {activeTab === 'products' && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Product
          </button>
        )}
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    HSN Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    GST (%)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price (₹)
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
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                            <Package className="h-6 w-6 text-green-600" />
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                        {product.unit}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.hsn_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.gst}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ₹{product.price}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(product.created_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded transition"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(product.id)}
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
        </div>
      )}

      {/* Pricing Tab */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          {/* Day Selection View */}
          {!selectedDay && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Select a Day to Manage Shop Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {weeklySchedule.map((daySchedule) => {
                  const dayShops = daySchedule.shops;
                  return (
                    <div
                      key={daySchedule.day}
                      onClick={() => handleDaySelect(daySchedule.day)}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition"
                    >
                      <h4 className="font-medium text-gray-900 mb-4">{daySchedule.day}</h4>
                      {dayShops.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          <Store className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                          <p>No shops assigned</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {dayShops.map((shop) => {
                            const productCount = shopProducts.filter(sp => sp.shop_id === shop.id).length;
                            return (
                              <div
                                key={shop.id}
                                className="p-3 bg-gray-50 rounded-lg"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-gray-900">{shop.shop_name}</div>
                                    <div className="text-sm text-gray-500">{productCount} products priced</div>
                                  </div>
                                  <Store className="h-5 w-5 text-blue-600" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Shop Selection View for Selected Day */}
          {selectedDay && !selectedShop && (
            <div>
              {/* Header with Back Button */}
              <div className="flex items-center mb-6">
                <button
                  onClick={handleBackToDays}
                  className="flex items-center text-blue-600 hover:text-blue-800 mr-4"
                >
                  <ArrowLeft className="h-5 w-5 mr-1" />
                  Back to Days
                </button>
                <div>
                  <h3 className="text-xl font-medium text-gray-900">
                    Shops for {selectedDay}
                  </h3>
                  <p className="text-gray-600">Select a shop to manage pricing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {weeklySchedule.find(ds => ds.day === selectedDay)?.shops.map((shop) => {
                  const productCount = shopProducts.filter(sp => sp.shop_id === shop.id).length;
                  return (
                    <div
                      key={shop.id}
                      onClick={() => handleShopSelect(shop.id)}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center mb-4">
                        <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                          <Store className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-900">{shop.shop_name}</h4>
                          <p className="text-sm text-gray-500">{productCount} products priced</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Click to manage pricing</span>
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Product Pricing View */}
          {selectedShop && (
            <div>
              {/* Header with Back Button */}
              <div className="flex items-center mb-6">
                <button
                  onClick={handleBackToShops}
                  className="flex items-center text-blue-600 hover:text-blue-800 mr-4"
                >
                  <ArrowLeft className="h-5 w-5 mr-1" />
                  Back to Shops
                </button>
                <div>
                  <h3 className="text-xl font-medium text-gray-900">
                    Pricing for {selectedShopData?.shop_name}
                  </h3>
                  <p className="text-gray-600">Manage product prices for this shop</p>
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price (₹)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {shopProductsList.map(({ product, pricing }) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                  <Package className="h-4 w-4 text-green-600" />
                                </div>
                              </div>
                              <div className="ml-3">
                                <div className="text-sm font-medium text-gray-900">{product.product_name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                              {product.unit}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {pricing && editingPriceId === pricing.id ? (
                              <div className="flex items-center">
                                <DollarSign className="h-4 w-4 text-green-600 mr-1" />
                                <input
                                  type="number"
                                  step="0.01"
                                  value={priceEditValue}
                                  onChange={(e) => setPriceEditValue(e.target.value)}
                                  className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handlePriceSave(pricing.id)}
                                  className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={handlePriceCancel}
                                  className="ml-1 px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <DollarSign className="h-4 w-4 text-green-600 mr-1" />
                                <span className="text-sm font-medium text-gray-900">
                                  {pricing ? `₹${pricing.price}` : 'Not set'}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              {pricing ? (
                                <>
                                  <button
                                    onClick={() => handlePriceEdit(pricing)}
                                    className="text-blue-600 hover:text-blue-900 p-1 rounded transition"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePricing(pricing.id)}
                                    className="text-red-600 hover:text-red-900 p-1 rounded transition"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleAddPricing(product.id)}
                                  className="text-green-600 hover:text-green-900 p-1 rounded transition"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <form onSubmit={handleProductSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.product_name}
                    onChange={(e) => setProductForm({ ...productForm, product_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit *
                  </label>
                  <select
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="kg">Kilogram (kg)</option>
                    <option value="gm">Gram (gm)</option>
                    <option value="ltr">Liter (ltr)</option>
                    <option value="ml">Milliliter (ml)</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="box">Box</option>
                    <option value="pack">Pack</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {/* Status field removed as per update */}
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    HSN Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={productForm.hsn_code}
                    onChange={(e) => setProductForm({ ...productForm, hsn_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter HSN code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GST (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={productForm.gst}
                    onChange={(e) => setProductForm({ ...productForm, gst: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.price}
                    onChange={(e) => setProductForm({ ...productForm, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter product price"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={resetProductForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                  >
                    {editingProduct ? 'Update' : 'Add'} Product
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
