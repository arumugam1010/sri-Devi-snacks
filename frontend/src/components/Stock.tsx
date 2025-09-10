import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, Package, IndianRupee, Warehouse } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { stocksAPI } from '../services/api';

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

const Stock: React.FC = () => {
  const { products, setProducts } = useAppContext();

  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingQuantityId, setEditingQuantityId] = useState<number | null>(null);
  const [quantityEditValue, setQuantityEditValue] = useState<string>('');

  const [productForm, setProductForm] = useState({
    product_name: '',
    unit: 'kg',
    status: 'active' as 'active' | 'inactive',
    gst: 5,
    quantity: 0,
    rate: 0,
    hsn_code: '',
    price: 0,
    stockId: null as number | null
  });

  // Fix: Use product rate from products context for display and editing
  const getProductRate = (productId: number) => {
    const product = products.find(p => p.id === productId);
    return product ? product.rate : 0;
  };

  const filteredProducts = products.filter(product =>
    product.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.unit.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStockValue = products.reduce((total, product) => {
    return total + (product.quantity * getProductRate(product.id));
  }, 0);

  // Fix: Ensure rate and value are displayed correctly even if rate is 0 or undefined
  const getProductValue = (product: Product) => {
    const rate = getProductRate(product.id) || 0;
    const quantity = product.quantity || 0;
    return rate * quantity;
  };

  const handleProductSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingProduct) {
      setProducts(products.map(product => 
        product.id === editingProduct.id 
          ? { ...product, ...productForm }
          : product
      ));
    } else {
      const newProduct: Product = {
        id: Math.max(...products.map(p => p.id)) + 1,
        ...productForm,
        created_date: new Date().toISOString().split('T')[0],
        price: productForm.price,
        stockId: productForm.stockId
      };
      setProducts([...products, newProduct]);
    }

    resetProductForm();
  };

  const resetProductForm = () => {
    setProductForm({
      product_name: '',
      unit: 'kg',
      status: 'active',
      gst: 5,
      quantity: 0,
      rate: 0,
      hsn_code: '',
      price: 0,
      stockId: null
    });
    setEditingProduct(null);
    setShowModal(false);
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      product_name: product.product_name,
      unit: product.unit,
      status: product.status,
      gst: product.gst,
      quantity: product.quantity,
      rate: product.rate,
      hsn_code: product.hsn_code,
      price: product.price,
      stockId: product.stockId
    });
    setShowModal(true);
  };

  const handleDeleteProduct = async (id: number) => {
    if (confirm('Are you sure you want to delete this product from stock?')) {
      // stocksAPI does not have deleteStock, so just update stock quantity to 0 or remove product from products list
      // Assuming backend does not support stock deletion, so we remove product from products list locally
      setProducts(products.filter(product => product.id !== id));
    }
  };

  const handleQuantityEdit = (product: Product) => {
    setEditingQuantityId(product.id);
    setQuantityEditValue(product.quantity.toString());
  };

  const handleQuantitySave = async (productId: number) => {
    const quantity = parseInt(quantityEditValue);
    if (!isNaN(quantity) && quantity >= 0) {
      const product = products.find(p => p.id === productId);
      if (!product) {
        alert('Product not found');
        setEditingQuantityId(null);
        return;
      }
      try {
        if (!product.stockId) {
          // Create stock entry if missing
          const createResponse = await stocksAPI.createStock({
            productId: product.id,
            quantity,
            rate: product.rate,
          });
          if (createResponse.success) {
            setProducts(products.map(p =>
              p.id === productId
                ? { ...p, quantity: quantity, stockId: createResponse.data.id, rate: createResponse.data.rate || p.rate }
                : p
            ));
          } else {
            alert(createResponse.message || 'Failed to create stock');
          }
        } else {
          const response = await stocksAPI.updateStock(product.stockId, { quantity });
          if (response.success) {
            setProducts(products.map(product =>
              product.id === productId
                ? { ...product, quantity: quantity, rate: response.data.rate || product.rate }
                : product
            ));
          } else {
            alert(response.message || 'Failed to update stock quantity');
          }
        }
      } catch (err: any) {
        alert(err.message || 'Error updating stock quantity');
      }
    }
    setEditingQuantityId(null);
  };

  const handleQuantityCancel = () => {
    setEditingQuantityId(null);
  };

  const handleQuantityAdjust = async (productId: number, amount: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      alert('Product not found');
      return;
    }
    const newQuantity = product.quantity + amount;
    try {
      if (!product.stockId) {
        // Create stock entry if missing
        const createResponse = await stocksAPI.createStock({
          productId: product.id,
          quantity: newQuantity,
          rate: product.rate,
        });
        if (createResponse.success) {
          setProducts(products.map(p =>
            p.id === productId
              ? { ...p, quantity: newQuantity, stockId: createResponse.data.id, rate: createResponse.data.rate || p.rate }
              : p
          ));
        } else {
          alert(createResponse.message || 'Failed to create stock');
        }
      } else {
        const response = await stocksAPI.updateStock(product.stockId, { quantity: newQuantity });
        if (response.success) {
          setProducts(products.map(product =>
            product.id === productId
              ? { ...product, quantity: newQuantity, rate: response.data.rate || product.rate }
              : product
          ));
        } else {
          alert(response.message || 'Failed to update stock quantity');
        }
      }
    } catch (err: any) {
      alert(err.message || 'Error updating stock quantity');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Stock Management</h2>
          <p className="text-gray-600 mt-1">Manage product quantities and rates</p>
        </div>
    
      </div>

      {/* Total Stock Value */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Warehouse className="h-6 w-6 text-blue-600 mr-2" />
            <span className="text-sm font-medium text-blue-800">Total Stock Value:</span>
          </div>
          <span className="text-xl font-bold text-blue-800">₹{totalStockValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
        <input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
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
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rate (₹)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Value (₹)
                </th>
              
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredProducts.map((product) => {
                const productValue = product.quantity * product.rate;
                return (
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
                          <div className="text-sm text-gray-500">
                            {product.status === 'active' ? 'Active' : 'Inactive'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                        {product.unit}
                      </span>
                    </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {editingQuantityId === product.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            min="0"
                            value={quantityEditValue}
                            onChange={(e) => setQuantityEditValue(e.target.value)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            autoFocus
                          />
                          <button
                            onClick={() => handleQuantitySave(product.id)}
                            className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleQuantityCancel}
                            className="px-2 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span>{product.quantity}</span>
                          <button
                            onClick={() => handleQuantityAdjust(product.id, 1)}
                            className="px-1 py-0.5 bg-green-600 text-white text-xs rounded hover:bg-green-700"
                            title="Increase quantity"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleQuantityAdjust(product.id, -1)}
                            className="px-1 py-0.5 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                            title="Decrease quantity"
                          >
                            -
                          </button>
                          <button
                            onClick={() => handleQuantityEdit(product)}
                            className="px-1 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            title="Edit quantity"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <IndianRupee className="h-4 w-4 text-green-600 mr-1" />
                    <span className="text-sm font-medium text-gray-900">{getProductRate(product.id)}</span>
                  </div>
                </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      ₹{getProductValue(product).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-lg bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {editingProduct ? 'Edit Product Stock' : 'Add Product to Stock'}
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
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={productForm.quantity}
                    onChange={(e) => setProductForm({ ...productForm, quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rate (₹) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={productForm.rate}
                    onChange={(e) => setProductForm({ ...productForm, rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={productForm.status}
                    onChange={(e) => setProductForm({ ...productForm, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
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

export default Stock;
