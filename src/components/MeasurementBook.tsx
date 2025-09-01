import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import ItemMeasurements from './ItemMeasurements';
import { 
  BookOpen, 
  Search, 
  Filter,
  Calculator,
  FileText,
  IndianRupee,
  Calendar,
  Building,
  Eye,
  Edit2,
  Plus,
  BarChart3,
  Ruler,
  Package,
  Clock,
  CheckCircle,
  AlertCircle
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
  } | null>(null);

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
      
      // Auto-select first work if available
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

      // Fetch work details
      const { data: work, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', worksId)
        .single();

      if (workError || !work) throw workError;

      // Fetch subworks
      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', worksId)
        .order('sr_no');

      if (subworksError) throw subworksError;

      // Fetch subwork items and measurements
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

        // Fetch measurements for each item
        for (const item of items || []) {
          const { data: itemMeasurements } = await supabase
            .schema('estimate')
            .from('item_measurements')
            .select('*')
            .eq('subwork_item_id', item.sr_no)
            .order('measurement_sr_no');

          measurements[item.id] = itemMeasurements || [];
          
          // Calculate total measurement amount
          const itemMeasurementTotal = (itemMeasurements || []).reduce((sum, m) => sum + (m.line_amount || 0), 0);
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

  const handleAddMeasurement = (item: SubworkItem, subwork: SubWork) => {
    setSelectedItemForMeasurement({
      itemId: item.sr_no,
      itemName: item.description_of_item,
      subworkId: subwork.subworks_id,
      subworkName: subwork.subworks_name
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
      draft: { bg: 'bg-gradient-to-r from-gray-100 to-slate-200', text: 'text-gray-800', label: 'Draft', icon: FileText },
      pending: { bg: 'bg-gradient-to-r from-amber-100 to-yellow-200', text: 'text-amber-800', label: 'Pending', icon: Clock },
      approved: { bg: 'bg-gradient-to-r from-green-100 to-emerald-200', text: 'text-green-800', label: 'Approved', icon: CheckCircle },
      rejected: { bg: 'bg-gradient-to-r from-red-100 to-pink-200', text: 'text-red-800', label: 'Rejected', icon: AlertCircle },
      in_progress: { bg: 'bg-gradient-to-r from-blue-100 to-indigo-200', text: 'text-blue-800', label: 'In Progress', icon: BarChart3 },
      completed: { bg: 'bg-gradient-to-r from-purple-100 to-violet-200', text: 'text-purple-800', label: 'Completed', icon: CheckCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const IconComponent = config.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text} shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}>
        <IconComponent className="w-3 h-3 mr-1" />
        {config.label}
      </span>
    );
  };

  const getMeasurementStatus = (item: SubworkItem) => {
    const itemMeasurements = measurementData?.measurements[item.id] || [];
    const measurementCount = itemMeasurements.length;
    const totalMeasurementAmount = itemMeasurements.reduce((sum, m) => sum + (m.line_amount || 0), 0);
    
    if (measurementCount === 0) {
      return { status: 'no_measurements', count: 0, amount: 0, color: 'from-gray-100 to-slate-200', textColor: 'text-gray-700' };
    } else if (totalMeasurementAmount > 0) {
      return { status: 'measured', count: measurementCount, amount: totalMeasurementAmount, color: 'from-green-100 to-emerald-200', textColor: 'text-green-700' };
    } else {
      return { status: 'partial', count: measurementCount, amount: totalMeasurementAmount, color: 'from-amber-100 to-yellow-200', textColor: 'text-amber-700' };
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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <div className="px-8 py-6">
          <div className="flex items-center">
            <div className="p-3 bg-white/20 rounded-2xl mr-4 shadow-lg">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                Measurement Book (MB)
              </h1>
              <p className="text-emerald-100 text-sm mt-1">Record and manage detailed measurements for construction works</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Work Selection */}
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              <Building className="w-4 h-4 inline mr-2" />
              Select Work
            </label>
            <select
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="block w-full pl-3 pr-8 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl bg-white/80 backdrop-blur-sm hover:bg-white transition-all duration-200 shadow-lg hover:shadow-xl"
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
          <div className="flex-1 relative max-w-md">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              <Search className="w-4 h-4 inline mr-2" />
              Search Works
            </label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{top: '32px'}}>
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search works..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 text-sm border border-gray-300 rounded-xl leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 hover:bg-white transition-all duration-200 shadow-lg hover:shadow-xl"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-end space-x-2 max-w-xs">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                Status Filter
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="block pl-3 pr-8 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 rounded-xl bg-white/80 backdrop-blur-sm hover:bg-white transition-all duration-200 shadow-lg hover:shadow-xl"
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
      </div>

      {/* Selected Work Info */}
      {measurementData && (
        <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-purple-100 rounded-2xl border border-indigo-200 p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.01]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-3">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl shadow-lg mr-3">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-indigo-900">
                  {measurementData.work.works_id} - {measurementData.work.work_name}
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-center text-indigo-700">
                  <Building className="w-4 h-4 mr-2 text-blue-500" />
                  <span>Division: {measurementData.work.division || 'N/A'}</span>
                </div>
                <div className="flex items-center text-indigo-700">
                  <IndianRupee className="w-4 h-4 mr-2 text-green-500" />
                  <span>Estimate: {formatCurrency(measurementData.work.total_estimated_cost)}</span>
                </div>
                <div className="flex items-center text-indigo-700">
                  <Ruler className="w-4 h-4 mr-2 text-purple-500" />
                  <span>Measured: {formatCurrency(measurementData.totalMeasurementAmount)}</span>
                </div>
              </div>
            </div>
            <div className="ml-6">
              {getStatusBadge(measurementData.work.status)}
            </div>
          </div>
        </div>
      )}

      {/* Measurement Book Content */}
      {measurementData ? (
        <div className="space-y-6">
          {measurementData.subworks.map((subwork, subworkIndex) => {
            const items = measurementData.subworkItems[subwork.subworks_id] || [];
            const subworkMeasurementTotal = items.reduce((sum, item) => {
              const itemMeasurements = measurementData.measurements[item.id] || [];
              return sum + itemMeasurements.reduce((itemSum, m) => itemSum + (m.line_amount || 0), 0);
            }, 0);

            // Color schemes for different subworks
            const colorSchemes = [
              { gradient: 'from-emerald-500 to-teal-600', bg: 'from-emerald-50 to-teal-100', border: 'border-emerald-200' },
              { gradient: 'from-purple-500 to-pink-600', bg: 'from-purple-50 to-pink-100', border: 'border-purple-200' },
              { gradient: 'from-orange-500 to-red-600', bg: 'from-orange-50 to-red-100', border: 'border-orange-200' },
              { gradient: 'from-indigo-500 to-blue-600', bg: 'from-indigo-50 to-blue-100', border: 'border-indigo-200' },
              { gradient: 'from-green-500 to-emerald-600', bg: 'from-green-50 to-emerald-100', border: 'border-green-200' },
              { gradient: 'from-teal-500 to-cyan-600', bg: 'from-teal-50 to-cyan-100', border: 'border-teal-200' },
              { gradient: 'from-pink-500 to-rose-600', bg: 'from-pink-50 to-rose-100', border: 'border-pink-200' },
              { gradient: 'from-amber-500 to-yellow-600', bg: 'from-amber-50 to-yellow-100', border: 'border-amber-200' },
              { gradient: 'from-violet-500 to-purple-600', bg: 'from-violet-50 to-purple-100', border: 'border-violet-200' },
              { gradient: 'from-red-500 to-pink-600', bg: 'from-red-50 to-pink-100', border: 'border-red-200' }
            ];
            
            const colorScheme = colorSchemes[subworkIndex % colorSchemes.length];

            return (
              <div key={subwork.subworks_id} className={`bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border ${colorScheme.border} overflow-hidden hover:shadow-2xl transition-all duration-300 hover:scale-[1.01]`}>
                <div className={`px-6 py-4 bg-gradient-to-r ${colorScheme.gradient}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="p-2 bg-white/20 rounded-lg mr-3">
                        <Calculator className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">
                          {subwork.subworks_id} - {subwork.subworks_name}
                        </h3>
                        <p className="text-white/80 text-sm">
                          {items.length} items • Measured: {formatCurrency(subworkMeasurementTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {items.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {items.map((item, itemIndex) => {
                      const measurementStatus = getMeasurementStatus(item);
                      const itemMeasurements = measurementData.measurements[item.id] || [];
                      
                      return (
                        <div
                          key={item.id}
                          className={`p-6 hover:bg-gradient-to-r hover:${colorScheme.bg} transition-all duration-200`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-4 mb-3">
                                <span className="text-sm font-bold text-gray-500">Item #{item.item_number}</span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-gradient-to-r ${measurementStatus.color} ${measurementStatus.textColor} shadow-lg`}>
                                  <Ruler className="w-3 h-3 mr-1" />
                                  {measurementStatus.count} measurements
                                </span>
                              </div>
                              
                              <h4 className="text-base font-bold text-gray-900 mb-3 line-clamp-2">
                                {item.description_of_item}
                              </h4>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="flex items-center text-gray-600">
                                  <Package className="w-4 h-4 mr-2 text-blue-500" />
                                  <span>Qty: {item.ssr_quantity} {item.ssr_unit}</span>
                                </div>
                                <div className="flex items-center text-gray-600">
                                  <IndianRupee className="w-4 h-4 mr-2 text-green-500" />
                                  <span>Rate: {formatCurrency(item.ssr_rate || 0)}</span>
                                </div>
                                <div className="flex items-center text-gray-600">
                                  <Calculator className="w-4 h-4 mr-2 text-purple-500" />
                                  <span>Estimate: {formatCurrency(item.total_item_amount || 0)}</span>
                                </div>
                                <div className="flex items-center text-gray-600">
                                  <Ruler className="w-4 h-4 mr-2 text-orange-500" />
                                  <span>Measured: {formatCurrency(measurementStatus.amount)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="ml-6">
                              <button
                                onClick={() => handleAddMeasurement(item, subwork)}
                                className={`inline-flex items-center px-4 py-2 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-gradient-to-r ${colorScheme.gradient} hover:shadow-xl hover:scale-105 focus:outline-none focus:ring-4 focus:ring-opacity-50 transition-all duration-300`}
                                style={{ focusRingColor: colorScheme.gradient.split(' ')[1] }}
                              >
                                <Edit2 className="w-4 h-4 mr-2" />
                                {measurementStatus.count > 0 ? 'Update Measurements' : 'Add Measurements'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className={`mx-auto w-16 h-16 bg-gradient-to-br ${colorScheme.bg} rounded-2xl flex items-center justify-center mb-4 shadow-lg`}>
                      <Package className="h-8 w-8 text-gray-500" />
                    </div>
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      No items available for measurement in this subwork.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : selectedWorkId ? (
        <div className="text-center py-16 bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-gray-200 to-slate-300 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
            <BookOpen className="h-10 w-10 text-gray-500" />
          </div>
          <h3 className="mt-2 text-lg font-bold text-gray-900">Loading measurement data...</h3>
          <p className="mt-2 text-sm text-gray-500">
            Please wait while we fetch the measurement book data.
          </p>
        </div>
      ) : (
        <div className="text-center py-16 bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
            <BookOpen className="h-10 w-10 text-emerald-600" />
          </div>
          <h3 className="mt-2 text-lg font-bold text-gray-900">Select a work to view measurements</h3>
          <p className="mt-2 text-sm text-gray-500">
            Choose a work from the dropdown above to start recording measurements.
          </p>
        </div>
      )}

      {/* Item Measurements Modal */}
      {showItemMeasurements && selectedItemForMeasurement && (
        <ItemMeasurements
          itemId={selectedItemForMeasurement.itemId}
          itemName={selectedItemForMeasurement.itemName}
          subworkId={selectedItemForMeasurement.subworkId}
          subworkName={selectedItemForMeasurement.subworkName}
          isOpen={showItemMeasurements}
          onClose={() => {
            setShowItemMeasurements(false);
            setSelectedItemForMeasurement(null);
            // Refresh measurement data
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