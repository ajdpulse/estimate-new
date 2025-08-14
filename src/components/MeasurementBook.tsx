import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
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
  Ruler,
  Download,
  Loader2
} from 'lucide-react';

interface MBWork extends Work {
  mb_status: 'pending' | 'in_progress' | 'completed';
  mb_started_at?: string;
  mb_completed_at?: string;
}

interface MBMeasurement {
  sr_no: number;
  work_id: string;
  subwork_id: string;
  item_id: string;
  measurement_sr_no: number;
  description_of_items: string;
  no_of_units: number;
  length: number;
  width_breadth: number;
  height_depth: number;
  estimated_quantity: number;
  actual_quantity: number;
  variance: number;
  variance_reason: string;
  unit: string;
  measured_by: string;
  measured_at: string;
  created_at: string;
  updated_at: string;
}

interface DocumentSettings {
  header: {
    zilla: string;
    division: string;
    subDivision: string;
    title: string;
  };
  footer: {
    preparedBy: string;
    designation: string;
  };
  pageSettings: {
    showPageNumbers: boolean;
    pageNumberPosition: 'top' | 'bottom';
    marginTop: number;
    marginBottom: number;
  };
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
  const [showPDFGenerator, setShowPDFGenerator] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const printRef = React.useRef<HTMLDivElement>(null);

  // Default document settings
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>({
    header: {
      zilla: "ZILLA PARISHAD, CHANDRAPUR",
      division: "RURAL WATER SUPPLY DIVISION, Z.P., CHANDRAPUR",
      subDivision: "RURAL WATER SUPPLY SUB-DIVISION (Z.P.), CHANDRAPUR",
      title: "MEASUREMENT BOOK"
    },
    footer: {
      preparedBy: "Pragati Bahu Uddeshiya Sanstha, Warora, Tah.- Chandrapur",
      designation: "Sub Divisional Engineer Z.P Rural Water supply Sub-Division, Chandrapur"
    },
    pageSettings: {
      showPageNumbers: true,
      pageNumberPosition: 'bottom',
      marginTop: 20,
      marginBottom: 20
    }
  });

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

      // Fetch subwork items
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

        // Fetch measurements from measurement_book table first
        for (const item of items || []) {
          const { data: mbMeasurements } = await supabase
            .schema('estimate')
            .from('measurement_book')
            .select('*')
            .eq('item_id', item.sr_no.toString())
            .order('measurement_sr_no');

          if (mbMeasurements && mbMeasurements.length > 0) {
            // Map measurement book data to component format
            measurementsData[item.sr_no] = mbMeasurements.map(m => ({
              sr_no: m.sr_no,
              work_id: m.work_id,
              subwork_id: m.subwork_id,
              item_id: m.item_id,
              measurement_sr_no: m.measurement_sr_no,
              description_of_items: m.description_of_items || item.description_of_item,
              no_of_units: m.no_of_units || 1,
              length: parseFloat(m.length?.toString() || '0'),
              width_breadth: parseFloat(m.width_breadth?.toString() || '0'),
              height_depth: parseFloat(m.height_depth?.toString() || '0'),
              estimated_quantity: parseFloat(m.estimated_quantity?.toString() || '0'),
              actual_quantity: parseFloat(m.actual_quantity?.toString() || '0'),
              variance: parseFloat(m.variance?.toString() || '0'),
              variance_reason: m.variance_reason || '',
              unit: m.unit || item.ssr_unit || '',
              measured_by: m.measured_by || user?.email || '',
              measured_at: m.measured_at || new Date().toISOString(),
              created_at: m.created_at || new Date().toISOString(),
              updated_at: m.updated_at || new Date().toISOString()
            }));
          } else {
            // Create default measurements from estimate data
            const { data: estimateMeasurements } = await supabase
              .schema('estimate')
              .from('item_measurements')
              .select('*')
              .eq('subwork_item_id', item.sr_no);

            measurementsData[item.sr_no] = (estimateMeasurements || []).map((m, index) => ({
              sr_no: 0, // Will be assigned by database
              work_id: workId,
              subwork_id: subwork.subworks_id,
              item_id: item.sr_no.toString(),
              measurement_sr_no: index + 1,
              description_of_items: m.description_of_items || item.description_of_item,
              no_of_units: m.no_of_units || 1,
              length: parseFloat(m.length?.toString() || '0'),
              width_breadth: parseFloat(m.width_breadth?.toString() || '0'),
              height_depth: parseFloat(m.height_depth?.toString() || '0'),
              estimated_quantity: parseFloat(m.calculated_quantity?.toString() || '0'),
              actual_quantity: parseFloat(m.calculated_quantity?.toString() || '0'),
              variance: 0,
              variance_reason: '',
              unit: m.unit || item.ssr_unit || '',
              measured_by: user?.email || '',
              measured_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }));
          }
        }
      }

      setSubworkItems(itemsData);
      setMeasurements(measurementsData);
    } catch (error) {
      console.error('Error fetching work details:', error);
    }
  };

  const updateMeasurement = (itemId: string, measurementSrNo: number, field: string, value: any) => {
    setMeasurements(prev => ({
      ...prev,
      [itemId]: prev[itemId].map(m => {
        if (m.measurement_sr_no === measurementSrNo) {
          const updated = { ...m, [field]: value };
          
          // Auto-calculate quantity if dimensions change
          if (['no_of_units', 'length', 'width_breadth', 'height_depth'].includes(field)) {
            const units = field === 'no_of_units' ? value : updated.no_of_units;
            const length = field === 'length' ? value : updated.length;
            const width = field === 'width_breadth' ? value : updated.width_breadth;
            const height = field === 'height_depth' ? value : updated.height_depth;
            
            const calculatedQty = units * length * width * height;
            updated.estimated_quantity = calculatedQty;
            updated.actual_quantity = calculatedQty;
            updated.variance = calculatedQty - m.estimated_quantity;
          }
          
          // Calculate variance if actual_quantity is manually updated
          if (field === 'actual_quantity') {
            updated.variance = value - m.estimated_quantity;
          }
          
          updated.updated_at = new Date().toISOString();
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
        if (measurement.sr_no === 0) {
          // Insert new measurement
          const { error } = await supabase
            .schema('estimate')
            .from('measurement_book')
            .insert({
              work_id: measurement.work_id,
              subwork_id: measurement.subwork_id,
              item_id: itemId,
              measurement_sr_no: measurement.measurement_sr_no,
              description_of_items: measurement.description_of_items,
              no_of_units: measurement.no_of_units,
              length: measurement.length,
              width_breadth: measurement.width_breadth,
              height_depth: measurement.height_depth,
              estimated_quantity: measurement.estimated_quantity,
              actual_quantity: measurement.actual_quantity,
              variance: measurement.variance,
              variance_reason: measurement.variance_reason,
              unit: measurement.unit,
              measured_by: measurement.measured_by
            });
          
          if (error) throw error;
        } else {
          // Update existing measurement
          const { error } = await supabase
            .schema('estimate')
            .from('measurement_book')
            .update({
              description_of_items: measurement.description_of_items,
              no_of_units: measurement.no_of_units,
              length: measurement.length,
              width_breadth: measurement.width_breadth,
              height_depth: measurement.height_depth,
              estimated_quantity: measurement.estimated_quantity,
              actual_quantity: measurement.actual_quantity,
              variance: measurement.variance,
              variance_reason: measurement.variance_reason,
              unit: measurement.unit,
              measured_by: measurement.measured_by,
              updated_at: new Date().toISOString()
            })
            .eq('sr_no', measurement.sr_no);
          
          if (error) throw error;
        }
      }
      
      // Refresh data after saving
      if (selectedWork) {
        await fetchWorkDetails(selectedWork.works_id);
      }
      
      setEditingMeasurement(null);
      alert('Measurements saved successfully!');
    } catch (error) {
      console.error('Error saving measurements:', error);
      alert('Error saving measurements: ' + error.message);
    }
  };

  const addNewMeasurement = (itemId: string) => {
    const existingMeasurements = measurements[itemId] || [];
    const lastMeasurement = existingMeasurements[existingMeasurements.length - 1];
    
    const newMeasurement: MBMeasurement = {
      sr_no: 0, // Will be assigned by database
      work_id: selectedWork?.works_id || '',
      subwork_id: selectedItem ? 
        Object.keys(subworkItems).find(key => 
          subworkItems[key].some(item => item.sr_no === selectedItem.sr_no)
        ) || '' : '',
      item_id: itemId.toString(),
      measurement_sr_no: existingMeasurements.length + 1,
      description_of_items: lastMeasurement?.description_of_items || selectedItem?.description_of_item || '',
      no_of_units: lastMeasurement?.no_of_units || 1,
      length: lastMeasurement?.length || 0,
      width_breadth: lastMeasurement?.width_breadth || 0,
      height_depth: lastMeasurement?.height_depth || 0,
      estimated_quantity: 0,
      actual_quantity: 0,
      variance: 0,
      variance_reason: '',
      unit: selectedItem?.ssr_unit || '',
      measured_by: user?.email || '',
      measured_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
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
                            const itemMeasurements = measurements[item.sr_no] || [];
                            const totalVariance = calculateTotalVariance(item.sr_no.toString());
                            
                            return (
                              <div key={item.sr_no} className="border border-gray-200 rounded-lg p-4">
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
                                        editingMeasurement === item.sr_no.toString() ? null : item.sr_no.toString()
                                      )}
                                      className="text-green-600 hover:text-green-800 p-1 rounded"
                                      title="Quick Edit"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>

                                {/* Quick Edit Mode */}
                                {editingMeasurement === item.sr_no.toString() && (
                                  <div className="mt-4 p-3 bg-gray-50 rounded border">
                                    <div className="flex items-center justify-between mb-2">
                                      <h6 className="text-sm font-medium">Quick Measurements</h6>
                                      <div className="flex items-center space-x-2">
                                        <button
                                          onClick={() => saveMeasurements(item.sr_no.toString())}
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
                                        <div key={measurement.measurement_sr_no} className="grid grid-cols-4 gap-2 text-xs">
                                          <input
                                            type="text"
                                            value={measurement.description_of_items}
                                            onChange={(e) => updateMeasurement(item.sr_no.toString(), measurement.measurement_sr_no, 'description_of_items', e.target.value)}
                                            className="px-2 py-1 border border-gray-300 rounded"
                                            placeholder="Description"
                                          />
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={measurement.actual_quantity || 0}
                                            onChange={(e) => updateMeasurement(item.sr_no.toString(), measurement.measurement_sr_no, 'actual_quantity', parseFloat(e.target.value) || 0)}
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
                                      {itemMeasurements.length > 3 && (
                                        <div className="text-xs text-gray-500 text-center">
                                          +{itemMeasurements.length - 3} more measurements...
                                        </div>
                                      )}
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
                  onClick={() => addNewMeasurement(selectedItem.sr_no.toString())}
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
                  {(measurements[selectedItem.sr_no] || []).map((measurement, index) => (
                    <tr key={measurement.measurement_sr_no}>
                      <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={measurement.description_of_items}
                          onChange={(e) => updateMeasurement(selectedItem.sr_no.toString(), measurement.measurement_sr_no, 'description_of_items', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={measurement.no_of_units}
                          onChange={(e) => updateMeasurement(selectedItem.sr_no.toString(), measurement.measurement_sr_no, 'no_of_units', parseInt(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={measurement.length}
                          onChange={(e) => updateMeasurement(selectedItem.sr_no.toString(), measurement.measurement_sr_no, 'length', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={measurement.width_breadth}
                          onChange={(e) => updateMeasurement(selectedItem.sr_no.toString(), measurement.measurement_sr_no, 'width_breadth', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={measurement.height_depth}
                          onChange={(e) => updateMeasurement(selectedItem.sr_no.toString(), measurement.measurement_sr_no, 'height_depth', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {measurement.estimated_quantity.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          step="0.01"
                          value={measurement.actual_quantity || 0}
                          onChange={(e) => updateMeasurement(selectedItem.sr_no.toString(), measurement.measurement_sr_no, 'actual_quantity', parseFloat(e.target.value) || 0)}
                          className="w-24 px-2 py-1 text-sm border border-gray-300 rounded bg-yellow-50"
                          placeholder="Auto-calculated"
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
                          onChange={(e) => updateMeasurement(selectedItem.sr_no.toString(), measurement.measurement_sr_no, 'variance_reason', e.target.value)}
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
                onClick={() => saveMeasurements(selectedItem.sr_no.toString())}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                Save Measurements
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MB PDF Generator Modal */}
      {showPDFGenerator && selectedWork && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-7xl shadow-lg rounded-md bg-white min-h-[90vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Generate Measurement Book Report</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={generateMBPDF}
                  disabled={pdfLoading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                >
                  {pdfLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Generate PDF
                </button>
                <button
                  onClick={() => setShowPDFGenerator(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[70vh] overflow-y-auto">
              <div ref={printRef} className="bg-white">
                
                {/* Page 1: Cover Page */}
                <div className="pdf-page bg-white p-8 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                  <PageHeader pageNumber={1} />
                  
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="text-center border-2 border-black p-8">
                      <h1 className="text-2xl font-bold underline mb-8">{documentSettings.header.title}</h1>
                      
                      <div className="mb-6">
                        <p className="text-lg font-semibold mb-2">{selectedWork.work_name}</p>
                        <p className="text-base">Tah: Chandrapur, Dist:- Chandrapur</p>
                      </div>
                      
                      <div className="mb-8">
                        <p className="text-lg mb-2">( 2024-25)</p>
                        <p className="text-xl font-bold">ACTUAL MEASURED COST. Rs. {calculateActualTotalEstimate().toLocaleString('hi-IN')}</p>
                        <p className="text-sm mt-2 text-gray-600">Based on Actual Field Measurements</p>
                      </div>
                      
                      <div className="mt-12">
                        <p className="text-lg font-semibold mb-6">OFFICE OF THE</p>
                        <div className="flex justify-center space-x-8">
                          <div className="border border-black p-4 text-center min-w-[200px]">
                            <p className="font-medium">Sub Divisional Engineer</p>
                            <p className="text-sm">Rural Water Supply(Z.P.) Sub-</p>
                            <p className="text-sm">Division, Chandrapur.</p>
                          </div>
                          <div className="border border-black p-4 text-center min-w-[200px]">
                            <p className="font-medium">Executive Engineer</p>
                            <p className="text-sm">Rural Water Supply Dn.</p>
                            <p className="text-sm">Z.P, Chandrapur.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <PageFooter pageNumber={1} />
                </div>

                {/* Page 2: Details Page */}
                <div className="pdf-page bg-white p-8 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                  <PageHeader pageNumber={2} />
                  
                  <div className="flex-1">
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold underline">{documentSettings.header.title}</h3>
                      <p className="mt-2">{selectedWork.work_name}</p>
                      <p>Tah: Chandrapur, Dist:- Chandrapur</p>
                    </div>

                    <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                      <div className="space-y-3">
                        <div className="flex">
                          <span className="w-40 font-medium">Name of Division</span>
                          <span className="mr-2">:-</span>
                          <span>{selectedWork.division || 'Rural Water Supply, Division, Z.P. Chandrapur'}</span>
                        </div>
                        <div className="flex">
                          <span className="w-40 font-medium">Name of Sub- Division</span>
                          <span className="mr-2">:-</span>
                          <span>{selectedWork.sub_division || 'Rural Water Supply Sub-Division Chandrapur'}</span>
                        </div>
                        <div className="flex">
                          <span className="w-40 font-medium">Fund Head</span>
                          <span className="mr-2">:-</span>
                          <span>{selectedWork.fund_head || 'SBM (G.) Phase-II & 15th Finance Commission'}</span>
                        </div>
                        <div className="flex">
                          <span className="w-40 font-medium">Major Head</span>
                          <span className="mr-2">:-</span>
                          <span className="italic">{selectedWork.major_head || '"SBM (G.) Phase-II & 15th Finance Commission - 2024-25"'}</span>
                        </div>
                        <div className="flex">
                          <span className="w-40 font-medium">Minor Head</span>
                          <span className="mr-2">:-</span>
                          <span>{selectedWork.minor_head || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="w-40 font-medium">Service Head</span>
                          <span className="mr-2">:-</span>
                          <span>{selectedWork.service_head || '-'}</span>
                        </div>
                        <div className="flex">
                          <span className="w-40 font-medium">Departmental Head</span>
                          <span className="mr-2">:-</span>
                          <span>{selectedWork.departmental_head || '-'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-8">
                      <div className="grid grid-cols-2 gap-8 text-lg mb-6">
                        <div>
                          <span className="font-bold">Original Estimated Cost Rs.</span>
                          <span className="ml-4">{selectedWork.total_estimated_cost.toLocaleString('hi-IN')}</span>
                        </div>
                        <div>
                          <span className="font-bold">Actual Measured Cost Rs.</span>
                          <span className="ml-4">{calculateActualTotalEstimate().toLocaleString('hi-IN')}</span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex">
                            <span className="w-48 font-medium">Administrative Approval No.</span>
                            <span className="mr-2">:-</span>
                            <span>-</span>
                          </div>
                          <div className="flex">
                            <span className="w-48 font-medium">Technically Sanctioned under</span>
                            <span className="mr-2">:-</span>
                            <span>-</span>
                          </div>
                          <div className="flex">
                            <span className="w-48 font-medium">Measurements Recorded By</span>
                            <span className="mr-2">:-</span>
                            <span>{documentSettings.footer.preparedBy}</span>
                          </div>
                          <div className="flex">
                            <span className="w-48 font-medium">Measurement Date</span>
                            <span className="mr-2">:-</span>
                            <span>{new Date().toLocaleDateString('hi-IN')}</span>
                          </div>
                          <div className="flex">
                            <span className="w-48 font-medium">Variance</span>
                            <span className="mr-2">:-</span>
                            <span className={calculateActualTotalEstimate() - selectedWork.total_estimated_cost > 0 ? 'text-red-600' : 'text-green-600'}>
                              Rs. {(calculateActualTotalEstimate() - selectedWork.total_estimated_cost).toLocaleString('hi-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-center mb-6">
                      <h4 className="font-bold text-base">Measurement Details</h4>
                      <p className="mt-2">------------------------- Attached Separately -------------------------</p>
                    </div>
                  </div>
                  
                  <PageFooter pageNumber={2} />
                </div>

                {/* Page 3: Recapitulation Sheet with Actual Values */}
                <div className="pdf-page bg-white p-8 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                  <PageHeader pageNumber={3} />
                  
                  <div className="flex-1">
                    <div className="text-center mb-6">
                      <p className="text-sm">Fund Head :- {selectedWork.fund_head || 'SBM (G.) Phase-II & 15th Finance Commission'}</p>
                      <p className="text-sm font-semibold">NAME OF WORK: {selectedWork.work_name}</p>
                      <p className="text-sm">Village :- Nakoda, GP :- Nakoda, Tah :- Chandrapur</p>
                      <h3 className="text-lg font-bold mt-4">MEASUREMENT BOOK RECAPITULATION SHEET</h3>
                      <p className="text-xs text-red-600 mt-2">(Based on Actual Field Measurements)</p>
                    </div>

                    <table className="w-full border-collapse border border-black text-xs mb-6">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-black p-2 text-center">Sr. No</th>
                          <th className="border border-black p-2">Type of work</th>
                          <th className="border border-black p-2">Item of Work</th>
                          <th className="border border-black p-2">Estimated Qty</th>
                          <th className="border border-black p-2">Actual Qty</th>
                          <th className="border border-black p-2">Variance</th>
                          <th className="border border-black p-2">Rate per unit (Rs.)</th>
                          <th className="border border-black p-2">Actual Amount (Rs.)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subworks.map((subwork, index) => {
                          const items = subworkItems[subwork.subworks_id] || [];
                          return items.map((item, itemIndex) => {
                            const itemMeasurements = measurements[item.sr_no.toString()] || [];
                            const actualQuantity = itemMeasurements.reduce((sum, m) => sum + (m.actual_quantity || 0), 0);
                            const variance = actualQuantity - (item.ssr_quantity || 0);
                            const actualAmount = actualQuantity * (item.ssr_rate || 0);
                            
                            return (
                              <tr key={`${subwork.subworks_id}-${item.sr_no}`}>
                                <td className="border border-black p-2 text-center">{index + 1}.{itemIndex + 1}</td>
                                <td className="border border-black p-2">Solid waste management</td>
                                <td className="border border-black p-2">{item.description_of_item}</td>
                                <td className="border border-black p-2 text-center">{item.ssr_quantity || 0} {item.ssr_unit}</td>
                                <td className="border border-black p-2 text-center">{actualQuantity.toFixed(2)} {item.ssr_unit}</td>
                                <td className={`border border-black p-2 text-center ${variance > 0 ? 'text-red-600' : variance < 0 ? 'text-green-600' : ''}`}>
                                  {variance > 0 ? '+' : ''}{variance.toFixed(2)}
                                </td>
                                <td className="border border-black p-2 text-right">{(item.ssr_rate || 0).toFixed(2)}</td>
                                <td className="border border-black p-2 text-right">{actualAmount.toFixed(2)}</td>
                              </tr>
                            );
                          });
                        })}
                        
                        {/* Total */}
                        <tr className="font-bold bg-gray-100">
                          <td colSpan={7} className="border border-black p-2 text-right">Total Actual Amount</td>
                          <td className="border border-black p-2 text-right">{calculateActualTotalEstimate().toFixed(2)}</td>
                        </tr>

                        {/* Variance Summary */}
                        <tr className="font-bold">
                          <td colSpan={7} className="border border-black p-2 text-right">Original Estimate</td>
                          <td className="border border-black p-2 text-right">{selectedWork.total_estimated_cost.toFixed(2)}</td>
                        </tr>
                        <tr className={`font-bold ${calculateActualTotalEstimate() - selectedWork.total_estimated_cost > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          <td colSpan={7} className="border border-black p-2 text-right">
                            Total Variance ({calculateActualTotalEstimate() > selectedWork.total_estimated_cost ? 'Over' : 'Under'} Estimate)
                          </td>
                          <td className="border border-black p-2 text-right">
                            {(calculateActualTotalEstimate() - selectedWork.total_estimated_cost).toFixed(2)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <PageFooter pageNumber={3} />
                </div>

                {/* Detailed Measurement Pages */}
                {subworks.map((subwork, subworkIndex) => {
                  const items = subworkItems[subwork.subworks_id] || [];
                  if (items.length === 0) return null;

                  return (
                    <div key={subwork.subworks_id} className="pdf-page bg-white p-8 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                      <PageHeader pageNumber={4 + subworkIndex} />
                      
                      <div className="flex-1">
                        <div className="text-center mb-6">
                          <p className="text-sm">Fund Head :- {selectedWork.fund_head || 'SBM (G.) Phase-II & 15th Finance Commission'}</p>
                          <p className="text-sm">Village :- Nakoda, GP :- Nakoda, Tah :- Chandrapur</p>
                          <h3 className="text-lg font-bold mt-4">Sub-work Measurements: {subwork.subworks_name}</h3>
                        </div>

                        {items.map((item) => {
                          const itemMeasurements = measurements[item.sr_no.toString()] || [];
                          
                          if (itemMeasurements.length === 0) return null;

                          return (
                            <div key={item.sr_no} className="mb-8">
                              <h4 className="font-bold mb-3 text-sm">Item: {item.description_of_item}</h4>
                              
                              <table className="w-full border-collapse border border-black text-xs mb-4">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border border-black p-1">Sr.</th>
                                    <th className="border border-black p-1">Description</th>
                                    <th className="border border-black p-1">Units</th>
                                    <th className="border border-black p-1">Length</th>
                                    <th className="border border-black p-1">Width</th>
                                    <th className="border border-black p-1">Height</th>
                                    <th className="border border-black p-1">Est. Qty</th>
                                    <th className="border border-black p-1">Actual Qty</th>
                                    <th className="border border-black p-1">Variance</th>
                                    <th className="border border-black p-1">Reason</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemMeasurements.map((measurement, idx) => (
                                    <tr key={measurement.measurement_sr_no}>
                                      <td className="border border-black p-1 text-center">{idx + 1}</td>
                                      <td className="border border-black p-1">{measurement.description_of_items}</td>
                                      <td className="border border-black p-1 text-center">{measurement.no_of_units}</td>
                                      <td className="border border-black p-1 text-center">{measurement.length}</td>
                                      <td className="border border-black p-1 text-center">{measurement.width_breadth}</td>
                                      <td className="border border-black p-1 text-center">{measurement.height_depth}</td>
                                      <td className="border border-black p-1 text-center">{measurement.estimated_quantity.toFixed(2)}</td>
                                      <td className="border border-black p-1 text-center">{measurement.actual_quantity.toFixed(2)}</td>
                                      <td className={`border border-black p-1 text-center ${
                                        measurement.variance > 0 ? 'text-red-600' : measurement.variance < 0 ? 'text-green-600' : ''
                                      }`}>
                                        {measurement.variance > 0 ? '+' : ''}{measurement.variance.toFixed(2)}
                                      </td>
                                      <td className="border border-black p-1 text-xs">{measurement.variance_reason || '-'}</td>
                                    </tr>
                                  ))}
                                  <tr className="font-bold bg-gray-100">
                                    <td colSpan={6} className="border border-black p-1 text-center">Total for Item</td>
                                    <td className="border border-black p-1 text-center">
                                      {itemMeasurements.reduce((sum, m) => sum + (m.estimated_quantity || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border border-black p-1 text-center">
                                      {itemMeasurements.reduce((sum, m) => sum + (m.actual_quantity || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border border-black p-1 text-center">
                                      {itemMeasurements.reduce((sum, m) => sum + (m.variance || 0), 0).toFixed(2)}
                                    </td>
                                    <td className="border border-black p-1"></td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          );
                        })}
                      </div>
                      
                      <PageFooter pageNumber={4 + subworkIndex} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <style jsx>{`
            @media print {
              .pdf-page {
                page-break-after: always;
                min-height: 297mm;
                width: 210mm;
              }
            }
            
            .pdf-page {
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              margin-bottom: 20px;
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default MeasurementBook;