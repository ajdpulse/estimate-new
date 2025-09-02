import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SubworkItem, ItemMeasurement, ItemLead, ItemMaterial, ItemRate } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save,
  X,
  Calculator,
  IndianRupee,
  Package,
  Ruler,
  Truck
} from 'lucide-react';

interface SubworkItemsProps {
  subworkId: string;
  subworkName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface NewItemForm {
  item_number: string;
  category: string;
  description_of_item: string;
  ssr_quantity: number;
  ssr_rate: number;
  ssr_unit: string;
  total_item_amount: number;
}

const SubworkItems: React.FC<SubworkItemsProps> = ({
  subworkId,
  subworkName,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [items, setItems] = useState<SubworkItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<SubworkItem | null>(null);
  const [newItem, setNewItem] = useState<NewItemForm>({
    item_number: '',
    category: '',
    description_of_item: '',
    ssr_quantity: 0,
    ssr_rate: 0,
    ssr_unit: '',
    total_item_amount: 0
  });

  useEffect(() => {
    if (isOpen) {
      fetchItems();
    }
  }, [isOpen, subworkId]);

  useEffect(() => {
    // Calculate total amount when quantity or rate changes
    const total = (newItem.ssr_quantity || 0) * (newItem.ssr_rate || 0);
    setNewItem(prev => ({ ...prev, total_item_amount: total }));
  }, [newItem.ssr_quantity, newItem.ssr_rate]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .select('*')
        .eq('subwork_id', subworkId)
        .order('sr_no');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.description_of_item || !user) return;

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .insert([{
          subwork_id: subworkId,
          item_number: newItem.item_number,
          category: newItem.category || null,
          description_of_item: newItem.description_of_item,
          ssr_quantity: newItem.ssr_quantity,
          ssr_rate: newItem.ssr_rate,
          ssr_unit: newItem.ssr_unit,
          total_item_amount: newItem.total_item_amount,
          created_by: user.id
        }]);

      if (error) throw error;
      
      setShowAddModal(false);
      resetForm();
      fetchItems();
    } catch (error) {
      console.error('Error adding item:', error);
    }
  };

  const handleEditItem = (item: SubworkItem) => {
    setEditingItem(item);
    setNewItem({
      item_number: item.item_number,
      category: item.category || '',
      description_of_item: item.description_of_item,
      ssr_quantity: item.ssr_quantity,
      ssr_rate: item.ssr_rate || 0,
      ssr_unit: item.ssr_unit || '',
      total_item_amount: item.total_item_amount || 0
    });
    setShowAddModal(true);
  };

  const handleUpdateItem = async () => {
    if (!newItem.description_of_item || !editingItem || !user) return;

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .update({
          item_number: newItem.item_number,
          category: newItem.category || null,
          description_of_item: newItem.description_of_item,
          ssr_quantity: newItem.ssr_quantity,
          ssr_rate: newItem.ssr_rate,
          ssr_unit: newItem.ssr_unit,
          total_item_amount: newItem.total_item_amount
        })
        .eq('sr_no', editingItem.sr_no);

      if (error) throw error;
      
      setShowAddModal(false);
      setEditingItem(null);
      resetForm();
      fetchItems();
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (item: SubworkItem) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .delete()
        .eq('sr_no', item.sr_no);

      if (error) throw error;
      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const resetForm = () => {
    setNewItem({
      item_number: '',
      category: '',
      description_of_item: '',
      ssr_quantity: 0,
      ssr_rate: 0,
      ssr_unit: '',
      total_item_amount: 0
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white min-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Subwork Items</h3>
            <p className="text-sm text-gray-500">{subworkName}</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add New Item
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner text="Loading items..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unit
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rate (₹)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount (₹)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.sr_no} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.item_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {item.category || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate" title={item.description_of_item}>
                        {item.description_of_item}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.ssr_quantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.ssr_unit}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(item.ssr_rate || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(item.total_item_amount || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditItem(item)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {items.length === 0 && (
              <div className="text-center py-12">
                <Package className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add items to this subwork to build your estimate.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Item Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingItem ? 'Edit Item' : 'Add New Item'}
                  </h3>
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingItem(null);
                      resetForm();
                    }}
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
                      value={subworkName}
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
                      value={newItem.category}
                      onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter category (optional)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description of Item *
                    </label>
                    <textarea
                      value={newItem.description_of_item}
                      onChange={(e) => setNewItem({...newItem, description_of_item: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter item description manually..."
                      rows={3}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item Number
                      </label>
                      <input
                        type="text"
                        value={newItem.item_number}
                        onChange={(e) => setNewItem({...newItem, item_number: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Item #"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.ssr_quantity}
                        onChange={(e) => setNewItem({...newItem, ssr_quantity: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={newItem.ssr_unit}
                        onChange={(e) => setNewItem({...newItem, ssr_unit: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Unit"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Rate (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newItem.ssr_rate}
                        onChange={(e) => setNewItem({...newItem, ssr_rate: parseFloat(e.target.value) || 0})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="0.00"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total Amount (₹)
                      </label>
                      <input
                        type="text"
                        value={formatCurrency(newItem.total_item_amount)}
                        disabled
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-700 font-medium"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingItem(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={editingItem ? handleUpdateItem : handleAddItem}
                    disabled={!newItem.description_of_item}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4 mr-2 inline" />
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubworkItems;