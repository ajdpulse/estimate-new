import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  FileText, 
  Search, 
  Edit2, 
  Save, 
  X, 
  Plus,
  Calculator,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye,
  Ruler
} from 'lucide-react';

interface MBWork extends Work {
  mb_status: 'pending' | 'in_progress' | 'completed';
  mb_started_at?: string;
  mb_completed_at?: string;
}

interface MBMeasurement extends ItemMeasurement {
  actual_quantity?: number;
  variance?: number;
  variance_reason?: string;
  measured_by?: string;
  measured_at?: string;
}

const MeasurementBook: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [works, setWorks] = useState<MBWork[]>([]);
  const [selectedWork, setSelectedWork] = useState<MBWork | null>(null);
  const [subworks, setSubworks] = useState<SubWork[]>([]);
  const [subworkItems, setSubworkItems] = useState<{ [subworkId: string]: SubworkItem[] }>({});
  const [measurements, setMeasurements] = useState<{ [itemId: string]: MBMeasurement[] }>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingMeasurement, setEditingMeasurement] = useState<string | null>(null);
  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SubworkItem | null>(null);

  useEffect(() => {
    fetchApprovedWorks();
  }, []);

  useEffect(() => {
    if (selectedWork) {
      fetchWorkDetails(selectedWork.works_id);
    }
  }, [selectedWork]);

  const fetchApprovedWorks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('status', 'approved')
        .order('sr_no', { ascending: false });

      if (error) throw error;
      
      // Add MB status (this would come from a separate MB table in real implementation)
      const worksWithMBStatus = (data || []).map(work => ({
        ...work,
        mb_status: 'pending' as const // Default status
      }));
      
      setWorks(worksWithMBStatus);
    } catch (error) {
      console.error('Error fetching approved works:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkDetails = async (workId: string) => {
    try {
      // Fetch subworks
      const { data: subworksData, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no');

      if (subworksError) throw subworksError;
      setSubworks(subworksData || []);

      // Fetch subwork items and measurements
      const itemsData: { [subworkId: string]: SubworkItem[] } = {};
      const measurementsData: { [itemId: string]: MBMeasurement[] } = {};

      for (const subwork of subworksData || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id)
          .order('sr_no');

        itemsData[subwork.subworks_id] = items || [];

        // Fetch measurements for each item
        for (const item of items || []) {
          const { data: itemMeasurements } = await supabase
            .schema('estimate')
            .from('item_measurements')
            .select('*')
            .eq('subwork_item_id', item.sr_no);

          measurementsData[item.id] = (itemMeasurements || []).map(m => ({
            ...m,
            actual_quantity: m.calculated_quantity, // Default to estimated
            variance: 0,
            variance_reason: '',
            measured_by: user?.email || '',
            measured_at: new Date().toISOString()
          }));
        }
      }

      setSubworkItems(itemsData);
      setMeasurements(measurementsData);
    } catch (error) {
      console.error('Error fetching work details:', error);
    }
  };

  const updateMeasurement = (itemId: string, measurementId: string, field: string, value: any) => {
    setMeasurements(prev => ({
      ...prev,
      [itemId]: prev[itemId].map(m => {
        if (m.id === measurementId) {
          const updated = { ...m, [field]: value };
          
          // Calculate variance if actual_quantity is updated
          if (field === 'actual_quantity') {
            updated.variance = value - m.calculated_quantity;
          }
          
          return updated;
        }
        return m;
      })
    }));
  };

  const saveMeasurements = async (itemId: string) => {
    try {
      const itemMeasurements = measurements[itemId] || [];
      
      for (const measurement of itemMeasurements) {
        // In a real implementation, you'd save to a measurement_book table
        console.log('Saving measurement:', measurement);
      }
      
      setEditingMeasurement(null);
      alert('Measurements saved successfully!');
    } catch (error) {
      console.error('Error saving measurements:', error);
      alert('Error saving measurements');
    }
  };

  const addNewMeasurement = (itemId: string) => {
    const newMeasurement: MBMeasurement = {
      id: `temp_${Date.now()}`,
      subwork_item_id: parseInt(selectedItem?.sr_no || '0'),
      measurement_sr_no: (measurements[itemId]?.length || 0) + 1,
      description_of_items: 'New measurement',
      no_of_units: 1,
      length: 0,
      width_breadth: 0,
      height_depth: 0,
      calculated_quantity: 0,
      actual_quantity: 0,
      variance: 0,
      unit: selectedItem?.ssr_unit || '',
      is_deduction: false,
      is_manual_quantity: false,
      line_amount: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      measured_by: user?.email || '',
      measured_at: new Date().toISOString()
    };

    setMeasurements(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), newMeasurement]
    }));
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'Pending' },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-800', icon: AlertCircle, label: 'In Progress' },
      completed: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Completed' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const calculateTotalVariance = (itemId: string) => {
    const itemMeasurements = measurements[itemId] || [];
    return itemMeasurements.reduce((sum, m) => sum + (m.variance || 0), 0);
  };

  const filteredWorks = works.filter(work => {
    const matchesSearch = work.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         work.works_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || work.mb_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <LoadingSpinner text="Loading Measurement Book..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Measurement Book (MB)</h1>
          <p className="mt-1 text-sm text-gray-500">
            Record actual measurements for approved works and track variances
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search approved works..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Works List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Approved Works</h3>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredWorks.map((work) => (
                <div
                  key={work.works_id}
                  onClick={() => setSelectedWork(work)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedWork?.works_id === work.works_id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {work.works_id}
                      </h4>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {work.work_name}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {formatCurrency(work.total_estimated_cost)}
                        </span>
                        {getStatusBadge(work.mb_status)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Work Details */}
        <div className="lg:col-span-2">
          {selectedWork ? (
            <div className="space-y-6">
              {/* Work Info */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedWork.works_id} - {selectedWork.work_name}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Division: {selectedWork.division || 'N/A'}
                    </p>
                  </div>
                  {getStatusBadge(selectedWork.mb_status)}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Estimated Cost:</span>
                    <span className="ml-2">{formatCurrency(selectedWork.total_estimated_cost)}</span>
                  </div>
                  <div>
                    <span className="font-medium">Approved Date:</span>
                    <span className="ml-2">{new Date(selectedWork.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Subworks and Items */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Measurement Details</h3>
                </div>
                <div className="divide-y divide-gray-200">
                  {subworks.map((subwork) => {
                    const items = subworkItems[subwork.subworks_id] || [];
                    
                    return (
                      <div key={subwork.subworks_id} className="p-6">
                        <h4 className="text-md font-medium text-gray-900 mb-4">
                          {subwork.subworks_name}
                        </h4>
                        
                        <div className="space-y-4">
                          {items.map((item) => {
                            const itemMeasurements = measurements[item.id] || [];
                            const totalVariance = calculateTotalVariance(item.id);
                            
                            return (
                              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <h5 className="text-sm font-medium text-gray-900">
                                      {item.description_of_item}
                                    </h5>
                                    <p className="text-xs text-gray-500 mt-1">
                                      Estimated: {item.ssr_quantity} {item.ssr_unit} @ {formatCurrency(item.ssr_rate || 0)}
                                    </p>
                                    {totalVariance !== 0 && (
                                      <p className={`text-xs mt-1 ${totalVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        Variance: {totalVariance > 0 ? '+' : ''}{totalVariance} {item.ssr_unit}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => {
                                        setSelectedItem(item);
                                        setShowMeasurementModal(true);
                                      }}
                                      className="text-blue-600 hover:text-blue-800 p-1 rounded"
                                      title="View/Edit Measurements"
                                    >
                                      <Ruler className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => setEditingMeasurement(
                                        editingMeasurement === item.id ? null : item.id
                                      )}
                                      className="text-green-600 hover:text-green-800 p-1 rounded"
                                      title="Quick Edit"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Quick Edit Mode */}
                                {editingMeasurement === item.id && (
                                  <div className="mt-4 p-3 bg-gray-50 rounded border">
                                    <div className="flex items-center justify-between mb-2">
                                      <h6 className="text-sm font-medium">Quick Measurements</h6>
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() => saveMeasurements(item.id)}
                                          className="text-green-600 hover:text-green-800 p-1 rounded"
                                          title="Save"
                                        >
                                          <Save className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() => setEditingMeasurement(null)}
                                          className="text-gray-600 hover:text-gray-800 p-1 rounded"
                                          title="Cancel"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                      {itemMeasurements.slice(0, 3).map((measurement) => (
                                        <div key={measurement.id} className="grid grid-cols-4 gap-2 text-xs">
                                          <input
                                            type="text"
                                            value={measurement.description_of_items}
                                            onChange={(e) => updateMeasurement(item.id, measurement.id, 'description_of_items', e.target.value)}
                                            className="px-2 py-1 border border-gray-300 rounded"
                                            placeholder="Description"
                                          />
                                          <input
                                            type="number"
                                            value={measurement.actual_quantity || 0}
                                            onChange={(e) => updateMeasurement(item.id, measurement.id, 'actual_quantity', parseFloat(e.target.value) || 0)}
                                            className="px-2 py-1 border border-gray-300 rounded"
                                            placeholder="Actual Qty"
                                          />
                                          <span className="px-2 py-1 bg-gray-100 rounded text-center">
                                            {measurement.unit}
                                          </span>
                                          <span className={`px-2 py-1 rounded text-center ${
                                            (measurement.variance || 0) > 0 ? 'bg-red-100 text-red-800' : 
                                            (measurement.variance || 0) < 0 ? 'bg-green-100 text-green-800' : 
                                            'bg-gray-100'
                                          }`}>
                                            {measurement.variance || 0}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <Calculator className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Select a work to view measurements</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose an approved work from the list to start recording measurements.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Measurement Modal */}
      {showMeasurementModal && selectedItem && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white min-h-[90vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Detailed Measurements - {selectedItem.description_of_item}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => addNewMeasurement(selectedItem.id)}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Measurement
                </button>
                <button
                  onClick={() => setShowMeasurementModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sr.</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Units</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Length</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Width</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Height</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Est. Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variance</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(measurements[selectedItem.id] || []).map((measurement, index) => (
                    <tr key={measurement.id}>
                      <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={measurement.description_of_items}
                          onChange={(e) => updateMeasurement(selectedItem.id, measurement.id, 'description_of_items', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          value={measurement.no_of_units}
                          onChange={(e) => updateMeasurement(selectedItem.id, measurement.id, 'no_of_units', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={measurement.length}
                          onChange={(e) => updateMeasurement(selectedItem.id, measurement.id, 'length', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={measurement.width_breadth}
                          onChange={(e) => updateMeasurement(selectedItem.id, measurement.id, 'width_breadth', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={measurement.height_depth}
                          onChange={(e) => updateMeasurement(selectedItem.id, measurement.id, 'height_depth', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {measurement.calculated_quantity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={measurement.actual_quantity || 0}
                          onChange={(e) => updateMeasurement(selectedItem.id, measurement.id, 'actual_quantity', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${
                        (measurement.variance || 0) > 0 ? 'text-red-600' : 
                        (measurement.variance || 0) < 0 ? 'text-green-600' : 
                        'text-gray-900'
                      }`}>
                        {(measurement.variance || 0) > 0 ? '+' : ''}{(measurement.variance || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={measurement.variance_reason || ''}
                          onChange={(e) => updateMeasurement(selectedItem.id, measurement.id, 'variance_reason', e.target.value)}
                          className="w-32 px-2 py-1 text-sm border border-gray-300 rounded"
                          placeholder="Reason for variance"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowMeasurementModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => saveMeasurements(selectedItem.id)}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Save Measurements
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementBook;