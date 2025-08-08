import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SubworkItem, ItemMeasurement } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Eye,
  Package,
  Calculator,
  X,
  Search,
  CheckCircle
} from 'lucide-react';

interface SubworkItemsProps {
  subworkId: string;
  subworkName: string;
  isOpen: boolean;
  onClose: () => void;
}

const SubworkItems: React.FC<SubworkItemsProps> = ({ 
  subworkId, 
  subworkName, 
  isOpen, 
  onClose 
}) => {
  const { user } = useAuth();
  const [subworkItems, setSubworkItems] = useState<SubworkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showMeasurementsModal, setShowMeasurementsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SubworkItem | null>(null);
  const [ssrSuggestions, setSsrSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchingSSR, setSearchingSSR] = useState(false);
  const [descriptionQuery, setDescriptionQuery] = useState('');
  const [newItem, setNewItem] = useState<Partial<SubworkItem>>({
    description_of_item: '',
    ssr_quantity: 0,
    ssr_rate: 0,
    ssr_unit: ''
  });

  useEffect(() => {
    if (isOpen && subworkId) {
      fetchSubworkItems();
    }
  }, [isOpen, subworkId]);

  const searchSSRItems = async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSsrSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setSearchingSSR(true);
      
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ssr-search`;
      const headers = {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: query.trim() })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSsrSuggestions(data.results || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Error searching SSR items:', error);
      setSsrSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setSearchingSSR(false);
    }
  };

  const handleDescriptionChange = (value: string) => {
    setDescriptionQuery(value);
    setNewItem({...newItem, description_of_item: value});
    
    // Debounce search
    const timeoutId = setTimeout(() => {
      searchSSRItems(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const selectSSRItem = (item: any) => {
    setNewItem({
      ...newItem,
      description_of_item: item.description,
      ssr_rate: parseFloat(item.rate_2024_25 || item.rate_2023_24 || '0'),
      ssr_unit: item.unit || ''
    });
    setDescriptionQuery(item.description);
    setShowSuggestions(false);
    setSsrSuggestions([]);
  };

  const fetchSubworkItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('*')
        .eq('subwork_id', subworkId)
        .order('item_number', { ascending: true });

      if (error) throw error;
      setSubworkItems(data || []);
    } catch (error) {
      console.error('Error fetching subwork items:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateItemNumber = async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('item_number')
        .eq('subwork_id', subworkId)
        .order('item_number', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastNumber = parseInt(data[0].item_number);
        nextNumber = lastNumber + 1;
      }

      return nextNumber.toString();
    } catch (error) {
      console.error('Error generating item number:', error);
      return '1';
    }
  };

  const handleAddItem = async () => {
    if (!newItem.description_of_item || !user) return;

    try {
      const itemNumber = await generateItemNumber();
      const totalAmount = (newItem.ssr_quantity || 0) * (newItem.ssr_rate || 0);

      const { error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .insert([{
          ...newItem,
          subwork_id: subworkId,
          item_number: itemNumber,
          total_item_amount: totalAmount,
          created_by: user.id
        }]);

      if (error) throw error;
      
      setShowAddItemModal(false);
      setNewItem({
        description_of_item: '',
        ssr_quantity: 0,
        ssr_rate: 0,
        ssr_unit: ''
      });
      fetchSubworkItems();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleEditItem = (item: SubworkItem) => {
    setSelectedItem(item);
    setNewItem({
      description_of_item: item.description_of_item,
      category: item.category,
      ssr_quantity: item.ssr_quantity,
      ssr_rate: item.ssr_rate,
      ssr_unit: item.ssr_unit
    });
    setShowEditItemModal(true);
  };

  const handleUpdateItem = async () => {
    if (!newItem.description_of_item || !selectedItem) return;

    try {
      const totalAmount = (newItem.ssr_quantity || 0) * (newItem.ssr_rate || 0);

      const { error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .update({
          ...newItem,
          total_item_amount: totalAmount
        })
        .eq('id', selectedItem.id);

      if (error) throw error;
      
      setShowEditItemModal(false);
      setSelectedItem(null);
      setNewItem({
        description_of_item: '',
        ssr_quantity: 0,
        ssr_rate: 0,
        ssr_unit: ''
      });
      fetchSubworkItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (item: SubworkItem) => {
    if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      fetchSubworkItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleViewMeasurements = (item: SubworkItem) => {
    setSelectedItem(item);
    setShowMeasurementsModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const totalItemsAmount = subworkItems.reduce((sum, item) => sum + item.total_item_amount, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Items - {subworkId}
              </h3>
              <p className="text-sm text-gray-500">{subworkName}</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="text-sm text-gray-600">
                Total: {formatCurrency(totalItemsAmount)}
              </div>
              <button 
                onClick={() => setShowAddItemModal(true)}
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                <Plus className="w-3 h-3 mr-1" />
                Add Item
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500">Loading items...</p>
              </div>
            ) : subworkItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item No
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rate
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Amount
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {subworkItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {item.item_number}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-gray-900">
                            {item.description_of_item}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">
                          {item.category || '-'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          {item.ssr_quantity} {item.ssr_unit}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                          ₹{item.ssr_rate.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(item.total_item_amount)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button 
                              onClick={() => handleViewMeasurements(item)}
                              className="text-purple-600 hover:text-purple-900 p-1 rounded"
                              title="View Measurements"
                            >
                              <Calculator className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleEditItem(item)}
                              className="text-green-600 hover:text-green-900 p-1 rounded"
                              title="Edit Item"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteItem(item)}
                              className="text-red-600 hover:text-red-900 p-1 rounded"
                              title="Delete Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add items to this sub work for detailed estimation.
                </p>
                <div className="mt-6">
                  <button 
                    onClick={() => setShowAddItemModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Item
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Item</h3>
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sub Work
                  </label>
                  <input
                    type="text"
                    value={`${subworkId} - ${subworkName}`}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newItem.category || ''}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter category (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description of Item *
                  </label>
                  <div className="relative">
                    <textarea
                      value={descriptionQuery}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter item description or search SSR items..."
                      rows={3}
                    />
                    {searchingSSR && (
                      <div className="absolute right-3 top-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                    
                    {/* SSR Suggestions Dropdown */}
                    {showSuggestions && ssrSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 text-xs text-gray-500 border-b">
                          <Search className="w-3 h-3 inline mr-1" />
                          SSR Rate Suggestions
                        </div>
                        {ssrSuggestions.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => selectSSRItem(item)}
                            className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {item.sr_no && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                                      Item {item.sr_no}
                                    </span>
                                  )}
                                  {item.description}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Section: {item.section} | Page: {item.page_number}
                                </div>
                                <div className="flex items-center mt-1 space-x-4">
                                  {item.unit && (
                                    <span className="text-xs text-gray-600">
                                      Unit: <span className="font-medium">{item.unit}</span>
                                    </span>
                                  )}
                                  {item.rate_2024_25 && (
                                    <span className="text-xs text-green-600">
                                      Rate 2024-25: <span className="font-medium">₹{item.rate_2024_25}</span>
                                    </span>
                                  )}
                                  {item.rate_2023_24 && (
                                    <span className="text-xs text-blue-600">
                                      Rate 2023-24: <span className="font-medium">₹{item.rate_2023_24}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="ml-2">
                                <div className="text-xs text-gray-500">
                                  {Math.round(item.confidence * 100)}% match
                                </div>
                                <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="p-2 text-xs text-gray-400 text-center border-t">
                          Click on an item to auto-fill rate and unit
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SSR Quantity *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={newItem.ssr_quantity || ''}
                      onChange={(e) => setNewItem({...newItem, ssr_quantity: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SSR Rate (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItem.ssr_rate || ''}
                      onChange={(e) => setNewItem({...newItem, ssr_rate: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={newItem.ssr_unit || ''}
                      onChange={(e) => setNewItem({...newItem, ssr_unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., sqm, cum, nos"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium text-gray-900">
                      ₹{((newItem.ssr_quantity || 0) * (newItem.ssr_rate || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={!newItem.description_of_item}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditItemModal && selectedItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Item</h3>
                <button
                  onClick={() => setShowEditItemModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item Number
                  </label>
                  <input
                    type="text"
                    value={selectedItem.item_number}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newItem.category || ''}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter category (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description of Item *
                  </label>
                  <div className="relative">
                    <textarea
                      value={descriptionQuery}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter item description or search SSR items..."
                      rows={3}
                    />
                    {searchingSSR && (
                      <div className="absolute right-3 top-3">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      </div>
                    )}
                    
                    {/* SSR Suggestions Dropdown */}
                    {showSuggestions && ssrSuggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="p-2 text-xs text-gray-500 border-b">
                          <Search className="w-3 h-3 inline mr-1" />
                          SSR Rate Suggestions
                        </div>
                        {ssrSuggestions.map((item, index) => (
                          <div
                            key={index}
                            onClick={() => selectSSRItem(item)}
                            className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">
                                  {item.sr_no && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                                      Item {item.sr_no}
                                    </span>
                                  )}
                                  {item.description}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Section: {item.section} | Page: {item.page_number}
                                </div>
                                <div className="flex items-center mt-1 space-x-4">
                                  {item.unit && (
                                    <span className="text-xs text-gray-600">
                                      Unit: <span className="font-medium">{item.unit}</span>
                                    </span>
                                  )}
                                  {item.rate_2024_25 && (
                                    <span className="text-xs text-green-600">
                                      Rate 2024-25: <span className="font-medium">₹{item.rate_2024_25}</span>
                                    </span>
                                  )}
                                  {item.rate_2023_24 && (
                                    <span className="text-xs text-blue-600">
                                      Rate 2023-24: <span className="font-medium">₹{item.rate_2023_24}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="ml-2">
                                <div className="text-xs text-gray-500">
                                  {Math.round(item.confidence * 100)}% match
                                </div>
                                <CheckCircle className="w-4 h-4 text-green-500 mt-1" />
                              </div>
                            </div>
                          </div>
                        ))}
                        <div className="p-2 text-xs text-gray-400 text-center border-t">
                          Click on an item to auto-fill rate and unit
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SSR Quantity *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={newItem.ssr_quantity || ''}
                      onChange={(e) => setNewItem({...newItem, ssr_quantity: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SSR Rate (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newItem.ssr_rate || ''}
                      onChange={(e) => setNewItem({...newItem, ssr_rate: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={newItem.ssr_unit || ''}
                      onChange={(e) => setNewItem({...newItem, ssr_unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., sqm, cum, nos"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium text-gray-900">
                      ₹{((newItem.ssr_quantity || 0) * (newItem.ssr_rate || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowEditItemModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateItem}
                  disabled={!newItem.description_of_item}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Measurements Modal */}
      {showMeasurementsModal && selectedItem && (
        <ItemMeasurements
          item={selectedItem}
          isOpen={showMeasurementsModal}
          onClose={() => setShowMeasurementsModal(false)}
        />
      )}
    </div>
  );
};

// Import the ItemMeasurements component
import ItemMeasurements from './ItemMeasurements';

export default SubworkItems;