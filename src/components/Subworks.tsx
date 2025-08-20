import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import SubworkItems from './SubworkItems';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Eye,
  FileText,
  IndianRupee,
  Calculator,
  ChevronRight
} from 'lucide-react';

const Subworks: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [works, setWorks] = useState<Work[]>([]);
  const [subworks, setSubworks] = useState<SubWork[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [selectedSubworkIds, setSelectedSubworkIds] = useState<string[]>([]);
  const [subworkItemCounts, setSubworkItemCounts] = useState<{[key: string]: number}>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSubwork, setSelectedSubwork] = useState<SubWork | null>(null);
  const [newSubwork, setNewSubwork] = useState<Partial<SubWork>>({
    subworks_name: ''
  });
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [currentSubworkForItems, setCurrentSubworkForItems] = useState<{ id: string; name: string } | null>(null);

  // Add state for subwork totals
  const [subworkTotals, setSubworkTotals] = useState<{[key: string]: number}>({});

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
      fetchSubworks(selectedWorkId);
    }
  }, [selectedWorkId]);

  useEffect(() => {
    if (selectedSubworkIds.length > 0) {
      fetchItemCounts();
      fetchSubworkTotals();
    }
  }, [selectedSubworkIds]);

  useEffect(() => {
    if (subworks.length > 0) {
      fetchSubworkTotals();
    }
  }, [subworks]);

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
        .order('sr_no', { ascending: true });

      if (error) throw error;
      setSubworks(data || []);
    } catch (error) {
      console.error('Error fetching subworks:', error);
    }
  };

  const fetchItemCounts = async () => {
    try {
      const counts: {[key: string]: number} = {};
      
      for (const subworkId of selectedSubworkIds) {
        const { count, error } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*', { count: 'exact', head: true })
          .eq('subwork_id', subworkId);

        if (error) throw error;
        counts[subworkId] = count || 0;
      }
      
      setSubworkItemCounts(counts);
    } catch (error) {
      console.error('Error fetching item counts:', error);
    }
  };

  const fetchSubworkTotals = async () => {
    try {
      const totals: {[key: string]: number} = {};
      
      for (const subwork of subworks) {
        const { data: items, error } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('total_item_amount')
          .eq('subwork_id', subwork.subworks_id);

        if (error) throw error;
        
        const total = (items || []).reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
        totals[subwork.subworks_id] = total;
      }
      
      setSubworkTotals(totals);
    } catch (error) {
      console.error('Error fetching subwork totals:', error);
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

  const handleSubworkCheckbox = (subworkId: string) => {
    setSelectedSubworkIds(prev => {
      if (prev.includes(subworkId)) {
        return prev.filter(id => id !== subworkId);
      } else {
        return [...prev, subworkId];
      }
    });
  };

  const handleViewItems = () => {
    if (selectedSubworkIds.length === 0) {
      alert('Please select at least one subwork to view items');
      return;
    }
    
    const firstSelected = subworks.find(sw => sw.subworks_id === selectedSubworkIds[0]);
    if (firstSelected) {
      setCurrentSubworkForItems({ id: firstSelected.subworks_id, name: firstSelected.subworks_name });
    }
    setShowItemsModal(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getTotalItemsCount = () => {
    return selectedSubworkIds.reduce((total, subworkId) => {
      return total + (subworkItemCounts[subworkId] || 0);
    }, 0);
  };

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
        <div className="mt-4 sm:mt-0">
          {/* Work Selection and Search */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Work Selection */}
            <div className="sm:w-48">
              <label className="block text-xs font-medium text-gray-700 mb-1">
               Select Work ID
              </label>
              <select
                value={selectedWorkId}
                onChange={(e) => setSelectedWorkId(e.target.value)}
                className="block w-full pl-2 pr-6 py-1.5 text-xs border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
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
            <div className="sm:w-56 relative">
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
                className="block w-full pl-6 pr-2 py-1.5 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-xs"
              />
            </div>
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
                <div className="flex items-center space-x-2">
                  <button 
                    onClick={() => setShowAddModal(true)}
                    disabled={!selectedWorkId}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200 disabled:opacity-50">
                    <Plus className="w-3 h-3 mr-1" />
                    Add Sub Work
                  </button>
                  <button
                    onClick={handleViewItems}
                    disabled={selectedSubworkIds.length === 0}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors duration-200 disabled:opacity-50"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View Items ({selectedSubworkIds.length > 0 ? `${getTotalItemsCount()} items` : '0 items'})
                  </button>
                </div>
              </div>
            </div>
            {filteredSubworks.length > 0 ? (
              <div className="divide-y divide-gray-200">
                {filteredSubworks.map((subwork) => (
                  <div
                    key={subwork.sr_no}
                    onClick={() => handleSubworkCheckbox(subwork.subworks_id)}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      selectedSubworkIds.includes(subwork.id) ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            selectedSubworkIds.includes(subwork.subworks_id) 
                              ? 'bg-blue-600 border-blue-600' 
                              : 'border-gray-300'
                          }`}>
                            {selectedSubworkIds.includes(subwork.subworks_id) && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-900">
                            {subwork.subworks_id}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {subwork.subworks_name}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-500">
                            Items: {subworkItemCounts[subwork.subworks_id] || 0}
                          </span>
                          <span className="text-sm font-medium text-green-600">
                            {formatCurrency(subworkTotals[subwork.subworks_id] || 0)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => {
                            setCurrentSubworkForItems({ id: subwork.subworks_id, name: subwork.subworks_name });
                            setShowItemsModal(true);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCurrentSubworkForItems({ id: subwork.subworks_id, name: subwork.subworks_name });
                            setShowItemsModal(true);
                          }}
                          className="text-green-600 hover:text-green-900 p-1 rounded"
                          title="Add Items"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
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

      {/* Subwork Items Component */}
      {showItemsModal && currentSubworkForItems && (
        <SubworkItems
          subworkId={currentSubworkForItems.id}
          subworkName={currentSubworkForItems.name}
          isOpen={showItemsModal}
          onClose={() => setShowItemsModal(false)}
        />
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