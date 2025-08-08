import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Eye,
  FileText,
  IndianRupee,
  Calculator
} from 'lucide-react';

const Subworks: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const location = useLocation();
  const [works, setWorks] = useState<Work[]>([]);
  const [subworks, setSubworks] = useState<SubWork[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSubwork, setSelectedSubwork] = useState<SubWork | null>(null);
  const [newSubwork, setNewSubwork] = useState<Partial<SubWork>>({
    subworks_name: ''
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
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
          <button 
            onClick={() => setShowAddModal(true)}
            disabled={!selectedWorkId}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200">
            <Plus className="w-4 h-4 mr-2" />
            Add Sub Work
          </button>
        </div>
      </div>

      {/* Work Selection and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Work Selection */}
          <div className="sm:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
             Select Work ID
            </label>
            <select
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
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
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search sub works..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm mt-6"
            />
          </div>
        </div>
      </div>

      {/* Selected Work Info */}
      {selectedWork && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium text-blue-900">
                {selectedWork.works_id} - {selectedWork.work_name}
              </h3>
              <p className="text-sm text-blue-700 mt-1">
                Division: {selectedWork.division || 'N/A'}
              </p>
              <div className="flex items-center mt-2 text-sm text-blue-600">
                <IndianRupee className="w-4 h-4 mr-1" />
                <span>Total Estimate: {formatCurrency(selectedWork.total_estimated_cost)}</span>
              </div>
            </div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {selectedWork.status}
            </span>
          </div>
        </div>
      )}

      {/* Subworks List */}
      {selectedWorkId ? (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          {filteredSubworks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sr No
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Works ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sub Works ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sub Works Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSubworks.map((subwork) => (
                    <tr key={subwork.sr_no} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {subwork.sr_no}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {subwork.works_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {subwork.subworks_id}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {subwork.subworks_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2">
                          <button 
                            onClick={() => handleViewSubwork(subwork)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded"
                            title="View Subwork"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleEditSubwork(subwork)}
                            className="text-green-600 hover:text-green-900 p-1 rounded"
                            title="Edit Subwork"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteSubwork(subwork)}
                            className="text-red-600 hover:text-red-900 p-1 rounded"
                            title="Delete Subwork"
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
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <FileText className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Select a work to view sub works</h3>
          <p className="mt-1 text-sm text-gray-500">
            Choose a main work item to manage its detailed sub work breakdown.
          </p>
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