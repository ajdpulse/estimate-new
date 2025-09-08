import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import ItemMeasurements from './ItemMeasurements';
import FullEstimateEditor from './FullEstimateEditor';
import { 
  BookOpen, 
  Search, 
  Filter,
  Calculator,
  FileText,
  IndianRupee,
  Building,
  Edit2,
  Plus,
  Ruler,
  CheckCircle,
  AlertCircle,
  Clock
} from 'lucide-react';

interface MeasurementBookData {
  work: Work;
  subworks: SubWork[];
  subworkItems: { [subworkId: string]: SubworkItem[] };
  measurements: { [itemId: string]: ItemMeasurement[] };
  totalMeasurementAmount: number;
}

const MeasurementBook: React.FC = () => {
  const { user } = useAuth();
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [measurementData, setMeasurementData] = useState<MeasurementBookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showItemMeasurements, setShowItemMeasurements] = useState(false);
  const [selectedItemForMeasurement, setSelectedItemForMeasurement] = useState<{
    itemId: string;
    itemName: string;
    subworkId: string;
    subworkName: string;
    itemSrNo: number;
  } | null>(null);
  const [showFullEstimateEdit, setShowFullEstimateEdit] = useState(false);
  const [editMode, setEditMode] = useState<'measurements' | 'full_estimate'>('measurements');
  const [expandedSubworks, setExpandedSubworks] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchWorks();
  }, []);

  useEffect(() => {
    if (selectedWorkId) {
      fetchMeasurementData(selectedWorkId);
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
      
      if (data && data.length > 0 && !selectedWorkId) {
        setSelectedWorkId(data[0].works_id);
      }
    } catch (error) {
      console.error('Error fetching works:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeasurementData = async (worksId: string) => {
    try {
      setLoading(true);

      const { data: work, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', worksId)
        .single();

      if (workError || !work) throw workError;

      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', worksId)
        .order('sr_no');

      if (subworksError) throw subworksError;

      const subworkItems: { [subworkId: string]: SubworkItem[] } = {};
      const measurements: { [itemId: string]: ItemMeasurement[] } = {};
      let totalMeasurementAmount = 0;

      for (const subwork of subworks || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id)
          .order('item_number');

        subworkItems[subwork.subworks_id] = items || [];

        for (const item of items || []) {
          // Fetch original measurements from item_measurements
          const { data: originalMeasurements } = await supabase
            .schema('estimate')
            .from('item_measurements')
            .select('*')
            .eq('subwork_item_id', item.sr_no)
            .order('measurement_sr_no');

          // Fetch modified measurements from measurement_book
          const { data: modifiedMeasurements } = await supabase
            .schema('estimate')
            .from('measurement_book')
            .select('*')
            .eq('subwork_item_id', item.sr_no)
            .eq('work_id', worksId)
            .order('measurement_sr_no');

          // Merge measurements: prioritize measurement_book data over item_measurements
          const mergedMeasurements = [...(originalMeasurements || [])];
          
          // Replace or add measurements from measurement_book
          (modifiedMeasurements || []).forEach(modifiedMeasurement => {
            const existingIndex = mergedMeasurements.findIndex(
              original => original.measurement_sr_no === modifiedMeasurement.measurement_sr_no
            );
            
            if (existingIndex >= 0) {
              // Replace existing measurement with modified version
              mergedMeasurements[existingIndex] = {
                ...mergedMeasurements[existingIndex],
                ...modifiedMeasurement,
                source: 'measurement_book' // Add source indicator
              };
            } else {
              // Add new measurement from measurement_book
              mergedMeasurements.push({
                ...modifiedMeasurement,
                source: 'measurement_book'
              });
            }
          });

          // Add source indicator to original measurements
          mergedMeasurements.forEach(measurement => {
            if (!measurement.source) {
              measurement.source = 'item_measurements';
            }
          });

          measurements[item.id] = mergedMeasurements;
          
          const itemMeasurementTotal = (itemMeasurements || []).reduce((sum, m) => sum + (m.calculated_quantity || 0), 0);
          totalMeasurementAmount += itemMeasurementTotal;
        }
      }

      setMeasurementData({
        work,
        subworks: subworks || [],
        subworkItems,
        measurements,
        totalMeasurementAmount
      });

    } catch (error) {
      console.error('Error fetching measurement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditMeasurements = (item: SubworkItem, subwork: SubWork) => {
    setSelectedItemForMeasurement({
      itemId: item.sr_no.toString(),
      itemName: item.description_of_item,
      subworkId: subwork.subworks_id,
      subworkName: subwork.subworks_name,
      itemSrNo: item.sr_no
    });
    setShowItemMeasurements(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft', icon: FileText },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending', icon: Clock },
      approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved', icon: CheckCircle },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: AlertCircle },
      in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress', icon: Calculator },
      completed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Completed', icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const IconComponent = config.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <IconComponent className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const toggleSubwork = (subworkId: string) => {
    setExpandedSubworks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(subworkId)) {
        newSet.delete(subworkId);
      } else {
        newSet.add(subworkId);
      }
      return newSet;
    });
  };

  const getMeasurementStatus = (item: SubworkItem) => {
    const itemMeasurements = measurementData?.measurements[item.sr_no] || [];
    const measurementCount = itemMeasurements.length;
    const totalMeasurementAmount = itemMeasurements.reduce((sum, m) => sum + (m.calculated_quantity || 0), 0);
    
    if (measurementCount === 0) {
      return { status: 'no_measurements', count: 0, amount: 0, color: 'text-gray-500', bgColor: 'bg-gray-50' };
    } else if (totalMeasurementAmount > 0) {
      return { status: 'measured', count: measurementCount, amount: totalMeasurementAmount, color: 'text-green-600', bgColor: 'bg-green-50' };
    } else {
      return { status: 'partial', count: measurementCount, amount: totalMeasurementAmount, color: 'text-yellow-600', bgColor: 'bg-yellow-50' };
    }
  };

  const filteredWorks = works.filter(work => {
    const matchesSearch = work.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (work.works_id && work.works_id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || work.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading && !measurementData) {
    return <LoadingSpinner text="Loading measurement book..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                Measurement Book (MB)
              </h1>
              <p className="text-emerald-100 text-base mt-1 drop-shadow">
                Record and manage detailed measurements for construction works
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Section */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Work Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Building className="w-4 h-4 inline mr-1" />
              Select Work
            </label>
            <select
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Select Work...</option>
              {works.map((work) => (
                <option key={work.works_id} value={work.works_id}>
                  {work.works_id} - {work.work_name}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-1" />
              Search Works
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search works..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-1" />
              Status Filter
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Selected Work Info */}
      {measurementData && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  {measurementData.work.works_id} - {measurementData.work.work_name}
                </h3>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                  <span className="flex items-center">
                    <Building className="w-4 h-4 mr-1" />
                    {measurementData.work.division || 'N/A'}
                  </span>
                  <span className="flex items-center">
                    <IndianRupee className="w-4 h-4 mr-1" />
                    Estimate: {formatCurrency(measurementData.work.total_estimated_cost)}
                  </span>
                  <span className="flex items-center">
                    <Ruler className="w-4 h-4 mr-1" />
                    Measured: {formatCurrency(measurementData.totalMeasurementAmount)}
                  </span>
                </div>
              </div>
            </div>
            <div>
              {getStatusBadge(measurementData.work.status)}
            </div>
          </div>
        </div>
      )}

      {/* Mode Selection */}
      {measurementData && (
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setEditMode('measurements')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                editMode === 'measurements'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center">
                <Ruler className="w-5 h-5 mr-2" />
                Edit Measurements Only
              </div>
            </button>
            <button
              onClick={() => setEditMode('full_estimate')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                editMode === 'full_estimate'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center justify-center">
                <FileText className="w-5 h-5 mr-2" />
                Estimate Editor
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="px-6 py-6">
        {measurementData && editMode === 'measurements' ? (
          <div className="space-y-6">
            {measurementData.subworks.map((subwork) => {
              const items = measurementData.subworkItems[subwork.subworks_id] || [];
              const isExpanded = expandedSubworks.has(subwork.subworks_id);

              return (
                <div key={subwork.subworks_id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                  <div 
                    className="px-6 py-4 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => toggleSubwork(subwork.subworks_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {subwork.subworks_id} - {subwork.subworks_name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">{items.length} items</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">
                          {isExpanded ? 'Click to collapse' : 'Click to expand'}
                        </span>
                        <svg 
                          className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {isExpanded && items.length > 0 ? (
                    <div className="divide-y divide-gray-200">
                      {items.map((item) => {
                        const measurementStatus = getMeasurementStatus(item);
                        
                        return (
                          <div key={item.id} className="px-6 py-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-3 mb-2">
                                  <span className="text-sm font-medium text-gray-500">#{item.item_number}</span>
                                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${measurementStatus.bgColor} ${measurementStatus.color}`}>
                                    {measurementStatus.count} measurements
                                  </span>
                                </div>
                                
                                <h4 className="font-medium text-gray-900 mb-2">
                                  {item.description_of_item}
                                </h4>
                                
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                  <div>
                                    <span className="font-medium">Quantity:</span> {item.ssr_quantity} {item.ssr_unit}
                                  </div>
                                  <div>
                                    <span className="font-medium">Rate:</span> {formatCurrency(item.ssr_rate || 0)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Estimate:</span> {formatCurrency(item.total_item_amount || 0)}
                                  </div>
                                  <div>
                                    <span className="font-medium">Measured:</span> {formatCurrency(measurementStatus.amount)}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="ml-6">
                                <button
                                  onClick={() => handleEditMeasurements(item, subwork)}
                                  className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
                                    measurementStatus.count > 0 
                                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                >
                                  <Edit2 className="w-4 h-4 mr-2" />
                                  {measurementStatus.count > 0 ? `Edit Measurements (${measurementStatus.count})` : 'Add Measurements'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : isExpanded && items.length === 0 ? (
                    <div className="px-6 py-8 text-center text-gray-500">
                      <Calculator className="mx-auto h-8 w-8 mb-2" />
                      <p>No items found in this subwork</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : selectedWorkId && editMode === 'full_estimate' ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Full Estimate Editor</h3>
              </div>
              <button
                onClick={() => setShowFullEstimateEdit(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Edit2 className="w-4 h-4 mr-2" />
                Open Excel-like Editor
              </button>
            </div>
            
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <p className="text-blue-800 text-sm">
                <strong>Full Estimate Editor:</strong> Edit the complete estimate in an Excel-like interface. 
                All changes will be saved as a draft version.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Select a work to begin</h3>
            <p className="text-gray-500">Choose a work from the dropdown above to start recording measurements.</p>
          </div>
        )}
      </div>

      {/* Full Estimate Editor Modal */}
      {showFullEstimateEdit && selectedWorkId && (
        <FullEstimateEditor
          workId={selectedWorkId}
          isOpen={showFullEstimateEdit}
          onClose={() => setShowFullEstimateEdit(false)}
          onSave={() => {
            if (selectedWorkId) {
              fetchMeasurementData(selectedWorkId);
            }
          }}
        />
      )}

      {/* Item Measurements Modal */}
      {showItemMeasurements && selectedItemForMeasurement && (
        <ItemMeasurements
          item={{
            id: selectedItemForMeasurement.itemSrNo.toString(),
            sr_no: selectedItemForMeasurement.itemSrNo,
            description_of_item: selectedItemForMeasurement.itemName,
            subwork_id: selectedItemForMeasurement.subworkId
          }}
          itemName={selectedItemForMeasurement.itemName}
          subworkId={selectedItemForMeasurement.subworkId}
          subworkName={selectedItemForMeasurement.subworkName}
          workId={selectedWorkId} // Pass workId to indicate Measurement Book context
          isOpen={showItemMeasurements}
          onClose={() => {
            setShowItemMeasurements(false);
            setSelectedItemForMeasurement(null);
            if (selectedWorkId) {
              fetchMeasurementData(selectedWorkId);
            }
          }}
        />
      )}
    </div>
  );
};

export default MeasurementBook;