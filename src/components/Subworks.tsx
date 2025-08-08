import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Eye,
  FileText,
  IndianRupee,
  Calculator,
  ChevronRight,
  Package
} from 'lucide-react';

const Subworks: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [works, setWorks] = useState<Work[]>([]);
  const [subworks, setSubworks] = useState<SubWork[]>([]);
  const [subworkItems, setSubworkItems] = useState<SubworkItem[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [selectedSubworkId, setSelectedSubworkId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [selectedSubwork, setSelectedSubwork] = useState<SubWork | null>(null);
  const [newSubwork, setNewSubwork] = useState<Partial<SubWork>>({
    subworks_name: ''
  });
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newSubworkItem, setNewSubworkItem] = useState<Partial<SubworkItem>>({
    description_of_item: '',
    ssr_quantity: 0,
    ssr_rate: 0
  });

  useEffect(() => {
    fetchWorks();
  }, []);

  useEffect(() => {
    // Check if we received a selected works ID from navigation state
    if (location.state?.selectedWorksId) {
      console.log('Setting selectedWorkId from navigation:', location.state.selectedWorksId);
      setSelectedWorkId(location.state.selectedWorksId);
      // Clear the navigation state to prevent re-execution
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  useEffect(() => {
    if (selectedWorkId) {
      console.log('selectedWorkId changed, fetching subworks for:', selectedWorkId);
      fetchSubworks(selectedWorkId);
    }
  }, [selectedWorkId]);

  useEffect(() => {
    if (selectedSubworkId) {
      fetchSubworkItems(selectedSubworkId);
    }
  }, [selectedSubworkId]);

  const fetchWorks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .order('sr_no', { ascending: false });

      if (error) throw error;
      setWorks(data || []);
      
      // Auto-select first work if available and no work was selected from navigation
      if (data && data.length > 0 && !selectedWorkId && !location.state?.selectedWorksId) {
        setSelectedWorkId(data[0].works_id);
      }
    } catch (error) {
      console.error('Error fetching works:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubworks = async (workId: string) => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no', { ascending: false });

      if (error) throw error;
      console.log('Fetching subworks for workId:', workId, 'Data:', data);
      setSubworks(data || []);
    } catch (error) {
      console.error('Error fetching subworks:', error);
    }
  };

  const fetchSubworkItems = async (subworkId: string) => {
    try {
      const { data, error } = await supabase
        .from('subwork_items')
        .select('*')
        .eq('subwork_id', subworkId)
        .order('item_number', { ascending: true });

      if (error) throw error;
      setSubworkItems(data || []);
    } catch (error) {
      console.error('Error fetching subwork items:', error);
    }
  };

  const generateSubworkId = async (worksId: string): Promise<string> => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('subworks_id')
        .eq('works_id', worksId)
        .order('sr_no', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0) {
        const lastSubworkId = data[0].subworks_id;
        const lastNumber = parseInt(lastSubworkId.split('-').pop() || '0');
        nextNumber = lastNumber + 1;
      }

      return `${worksId}-${nextNumber}`;
    } catch (error) {
      console.error('Error generating subwork ID:', error);
      return `${worksId}-1`;
    }
  };

  const handleAddSubwork = async () => {
    if (!newSubwork.subworks_name || !selectedWorkId || !user) return;

    try {
      const subworksId = await generateSubworkId(selectedWorkId);
      
      const { error } = await supabase
        .schema('estimate')
        .from('subworks')
        .insert([{
          works_id: selectedWorkId,
          subworks_id: subworksId,
          subworks_name: newSubwork.subworks_name,
          created_by: user.id
        }]);

      if (error) throw error;
      
      setShowAddModal(false);
      setNewSubwork({ subworks_name: '' });
      fetchSubworks(selectedWorkId);
    } catch (error) {
      console.error('Error adding subwork:', error);
    }
  };

  const handleAddSubworkItem = async () => {
    if (!newSubworkItem.description_of_item || !selectedSubworkId || !user) return;

    try {
      // Generate item number
      const { data: existingItems } = await supabase
        .from('subwork_items')
        .select('item_number')
        .eq('subwork_id', selectedSubworkId)
        .order('item_number', { ascending: false })
        .limit(1);

      let nextItemNumber = '1';
      if (existingItems && existingItems.length > 0) {
        const lastNumber = parseInt(existingItems[0].item_number);
        nextItemNumber = (lastNumber + 1).toString();
      }

      const totalAmount = (newSubworkItem.ssr_quantity || 0) * (newSubworkItem.ssr_rate || 0);

      const { error } = await supabase
        .from('subwork_items')
        .insert([{
          ...newSubworkItem,
          subwork_id: selectedSubworkId,
          item_number: nextItemNumber,
          total_item_amount: totalAmount,
          created_by: user.id
        }]);

      if (error) throw error;
      
      setShowAddItemModal(false);
      setNewSubworkItem({
        description_of_item: '',
        ssr_quantity: 0,
        ssr_rate: 0
      });
      fetchSubworkItems(selectedSubworkId);
    } catch (error) {
      console.error('Error adding subwork item:', error);
    }
  };

  const handleViewSubwork = (subwork: SubWork) => {
    setSelectedSubwork(subwork);
    setShowViewModal(true);
  };

  const handleEditSubwork = (subwork: SubWork) => {
    setSelectedSubwork(subwork);
    setNewSubwork({
      subworks_name: subwork.subworks_name
    });
    setShowEditModal(true);
  };

  const handleUpdateSubwork = async () => {
    if (!newSubwork.subworks_name || !selectedSubwork) return;

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('subworks')
        .update({ subworks_name: newSubwork.subworks_name })
        .eq('sr_no', selectedSubwork.sr_no);

      if (error) throw error;
      
      setShowEditModal(false);
      setSelectedSubwork(null);
      setNewSubwork({ subworks_name: '' });
      fetchSubworks(selectedWorkId);
    } catch (error) {
      console.error('Error updating subwork:', error);
    }
  };

  const handleDeleteSubwork = async (subwork: SubWork) => {
    if (!confirm('Are you sure you want to delete this subwork? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('subworks')
        .delete()
        .eq('sr_no', subwork.sr_no);

      if (error) throw error;
      fetchSubworks(selectedWorkId);
    } catch (error) {
      console.error('Error deleting subwork:', error);
    }
  };

  const handleSubworkClick = (subwork: SubWork) => {
    setSelectedSubworkId(subwork.id);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const activeSubworkForItems = subworks.find(sw => sw.id === selectedSubworkId);
  const filteredSubworkItems = subworkItems.filter(item =>
    item.description_of_item.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedWork = works.find(work => work.works_id === selectedWorkId);
  
  const filteredSubworks = subworks.filter(subwork =>
    subwork.subworks_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    subwork.subworks_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('subworks.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage detailed sub-work items and their estimates
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-2">
          <button 
            onClick={() => setShowAddModal(true)}
            disabled={!selectedWorkId}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50">
            <Plus className="w-4 h-4 mr-2" />
            Add Sub Work
          </button>
          <button 
            onClick={() => setShowAddItemModal(true)}
            disabled={!selectedSubworkId}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 disabled:opacity-50">
            <Package className="w-4 h-4 mr-2" />
            Add Item
          </button>
        </div>
      </div>

      {/* Work Selection and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Work Selection */}
          <div className="sm:w-1/4">
            <label className="block text-xs font-medium text-gray-700 mb-1">
             Select Work ID
            </label>
            <select
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="block w-full pl-2 pr-8 py-1.5 text-sm border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
            >
             <option value="">Select Work ID...</option>
              {works.map((work) => (
                <option key={work.works_id} value={work.works_id}>
                 {work.works_id}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="sm:w-1/3 relative">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Search Sub Works
            </label>
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none" style={{top: '20px'}}>
              <Search className="h-3 w-3 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search sub works..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Selected Work Info */}
      {selectedWork && (
        <div className="bg-blue-50 rounded-md border border-blue-200 p-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-blue-900">
                {selectedWork.works_id} - {selectedWork.work_name}
              </h3>
              <p className="text-xs text-blue-700 mt-1">
                Division: {selectedWork.division || 'N/A'}
              </p>
              <div className="flex items-center mt-1 text-xs text-blue-600">
                <IndianRupee className="w-3 h-3 mr-1" />
                <span>Total Estimate: {formatCurrency(selectedWork.total_estimated_cost)}</span>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {selectedWork.status}
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {selectedWorkId ? (
        <div className="grid grid-cols-1 gap-6">
          {/* Left Panel - Subworks List */}
          <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Sub Works</h3>
                <button 
                  onClick={() => setShowItemsModal(true)}
                  disabled={!selectedSubworkId}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Package className="w-3 h-3 mr-1" />
                  View Items
                </button>
              </div>
            </div>
            {filteredSubworks.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredSubworks.map((subwork) => (
                  <div
                    key={subwork.sr_no}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedSubworkId === subwork.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                    onClick={() => handleSubworkClick(subwork)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900">
                            {subwork.subworks_id}
                          </span>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {subwork.subworks_name}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewSubwork(subwork);
                          }}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          title="View Subwork"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditSubwork(subwork);
                          }}
                          className="text-green-600 hover:text-green-900 p-1 rounded"
                          title="Edit Subwork"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSubwork(subwork);
                          }}
                          className="text-red-600 hover:text-red-900 p-1 rounded"
                          title="Delete Subwork"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calculator className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No sub works found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Add sub work items to break down the estimate.
                </p>
                <div className="mt-6">
                  <button 
                    onClick={() => setShowAddModal(true)}
                    disabled={!selectedWorkId}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Sub Work
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Select a work to view sub works</h3>
          <p className="mt-1 text-sm text-gray-500">
            Choose a main work item to manage its detailed sub work breakdown.
          </p>
        </div>
      )}

      {/* Items Modal */}
      {showItemsModal && selectedSubworkId && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-10 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  Items - {activeSubworkForItems?.subworks_id}
                </h3>
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setShowAddItemModal(true)}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Item
                  </button>
                  <button
                    onClick={() => setShowItemsModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <span className="sr-only">Close</span>
                    ✕
                  </button>
                </div>
              </div>
              
              <div className="max-h-96 overflow-y-auto">
                {filteredSubworkItems.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {filteredSubworkItems.map((item) => (
                      <div key={item.id} className="p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Item {item.item_number}
                              </span>
                              {item.category && (
                                <span className="text-xs text-gray-500">
                                  {item.category}
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-medium text-gray-900 mt-1">
                              {item.description_of_item}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                              <span>Qty: {item.ssr_quantity} {item.ssr_unit}</span>
                              <span>Rate: ₹{item.ssr_rate}</span>
                              <span className="font-medium text-gray-900">
                                Total: ₹{item.total_item_amount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Add items to this sub work for detailed estimation.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Subwork Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Item</h3>
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sub Work
                  </label>
                  <input
                    type="text"
                    value={selectedSubwork?.subworks_id || ''}
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
                    value={newSubworkItem.category || ''}
                    onChange={(e) => setNewSubworkItem({...newSubworkItem, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter category (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description of Item *
                  </label>
                  <textarea
                    value={newSubworkItem.description_of_item || ''}
                    onChange={(e) => setNewSubworkItem({...newSubworkItem, description_of_item: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter item description"
                    rows={3}
                  />
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
                      value={newSubworkItem.ssr_quantity || ''}
                      onChange={(e) => setNewSubworkItem({...newSubworkItem, ssr_quantity: parseFloat(e.target.value) || 0})}
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
                      value={newSubworkItem.ssr_rate || ''}
                      onChange={(e) => setNewSubworkItem({...newSubworkItem, ssr_rate: parseFloat(e.target.value) || 0})}
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
                      value={newSubworkItem.ssr_unit || ''}
                      onChange={(e) => setNewSubworkItem({...newSubworkItem, ssr_unit: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., sqm, cum, nos"
                    />
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-medium text-gray-900">
                      ₹{((newSubworkItem.ssr_quantity || 0) * (newSubworkItem.ssr_rate || 0)).toFixed(2)}
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
                  onClick={handleAddSubworkItem}
                  disabled={!newSubworkItem.description_of_item}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Subwork Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Sub Work</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Works ID
                  </label>
                  <input
                    type="text"
                    value={selectedWorkId}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sub Works Name *
                  </label>
                  <input
                    type="text"
                    value={newSubwork.subworks_name || ''}
                    onChange={(e) => setNewSubwork({...newSubwork, subworks_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter sub work name"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddSubwork}
                  disabled={!newSubwork.subworks_name}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Sub Work
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Subwork Modal */}
      {showViewModal && selectedSubwork && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">View Sub Work Details</h3>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sr No</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedSubwork.sr_no}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Works ID</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedSubwork.works_id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Works ID</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedSubwork.subworks_id}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Works Name</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">{selectedSubwork.subworks_name}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created Date</label>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                    {new Date(selectedSubwork.created_at).toLocaleDateString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowViewModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Subwork Modal */}
      {showEditModal && selectedSubwork && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Sub Work</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Works ID
                  </label>
                  <input
                    type="text"
                    value={selectedSubwork.works_id}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sub Works ID
                  </label>
                  <input
                    type="text"
                    value={selectedSubwork.subworks_id}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sub Works Name *
                  </label>
                  <input
                    type="text"
                    value={newSubwork.subworks_name || ''}
                    onChange={(e) => setNewSubwork({...newSubwork, subworks_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter sub work name"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSubwork}
                  disabled={!newSubwork.subworks_name}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Update Sub Work
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Subworks;