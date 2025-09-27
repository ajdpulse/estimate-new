import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { BookOpen, Search, Filter, Plus, Save, Download, Calculator, Ruler, CreditCard as Edit2, Trash2, Eye, RefreshCw, AlertTriangle, CheckCircle, FileSpreadsheet, Import, Upload } from 'lucide-react';

interface MeasurementBookEntry {
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

interface EstimateData {
  work: Work;
  subworks: SubWork[];
  subworkItems: { [subworkId: string]: SubworkItem[] };
}

const MeasurementBook = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  // State management
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWorkId, setSelectedWorkId] = useState<string>('');
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubworkId, setSelectedSubworkId] = useState<string>('all');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [newMeasurement, setNewMeasurement] = useState<Partial<MeasurementBookEntry>>({});
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch works on component mount
  useEffect(() => {
    fetchWorks();
  }, []);

  // Fetch estimate data when work is selected
  useEffect(() => {
    if (selectedWorkId) {
      fetchEstimateData(selectedWorkId);
      fetchMeasurements(selectedWorkId);
    }
  }, [selectedWorkId]);

  const fetchWorks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .in('status', ['approved', 'in_progress', 'completed', 'draft'])
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

  const fetchEstimateData = async (workId: string) => {
    try {
      // Fetch work details
      const { data: work, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', workId)
        .single();

      if (workError) throw workError;

      // Fetch subworks
      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no');

      if (subworksError) throw subworksError;

      // Fetch subwork items
      const subworkItems: { [subworkId: string]: SubworkItem[] } = {};
      
      for (const subwork of subworks || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id)
          .order('sr_no');

        subworkItems[subwork.subworks_id] = items || [];
      }

      setEstimateData({
        work,
        subworks: subworks || [],
        subworkItems
      });

    } catch (error) {
      console.error('Error fetching estimate data:', error);
    }
  };

  const fetchMeasurements = async (workId: string) => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('measurement_book')
        .select('*')
        .eq('work_id', workId)
        .order('sr_no', { ascending: true });

      if (error) throw error;
      setMeasurements(data || []);
    } catch (error) {
      console.error('Error fetching measurements:', error);
    }
  };

  const importFromEstimate = async () => {
    if (!estimateData || !user) return;

    try {
      setSaving(true);
      const importedMeasurements: Partial<MeasurementBookEntry>[] = [];

      // Import from existing item_measurements
      for (const subwork of estimateData.subworks) {
        const items = estimateData.subworkItems[subwork.subworks_id] || [];
        
        for (const item of items) {
          // Fetch existing measurements for this item
          const { data: existingMeasurements } = await supabase
            .schema('estimate')
            .from('item_measurements')
            .select('*')
            .eq('subwork_item_id', item.sr_no);

          if (existingMeasurements && existingMeasurements.length > 0) {
            // Import existing measurements
            for (const measurement of existingMeasurements) {
              importedMeasurements.push({
                work_id: estimateData.work.works_id,
                subwork_id: subwork.subworks_id,
                item_id: item.id,
                measurement_sr_no: measurement.sr_no,
                description_of_items: measurement.description_of_items || item.description_of_item,
                no_of_units: measurement.no_of_units || 1,
                length: measurement.length || 0,
                width_breadth: measurement.width_breadth || 0,
                height_depth: measurement.height_depth || 0,
                estimated_quantity: measurement.calculated_quantity || 0,
                actual_quantity: measurement.actual_quantity || measurement.calculated_quantity || 0,
                unit: measurement.unit || item.ssr_unit,
                measured_by: user.email || 'System Import'
              });
            }
          } else {
            // Create default measurement entry for items without measurements
            importedMeasurements.push({
              work_id: estimateData.work.works_id,
              subwork_id: subwork.subworks_id,
              item_id: item.id,
              measurement_sr_no: 1,
              description_of_items: item.description_of_item,
              no_of_units: item.ssr_quantity || 1,
              length: 0,
              width_breadth: 0,
              height_depth: 0,
              estimated_quantity: item.ssr_quantity || 0,
              actual_quantity: 0,
              unit: item.ssr_unit,
              measured_by: user.email || 'System Import'
            });
          }
        }
      }

      // Insert imported measurements
      if (importedMeasurements.length > 0) {
        const { error } = await supabase
          .schema('estimate')
          .from('measurement_book')
          .insert(importedMeasurements);

        if (error) throw error;
        
        alert(`Successfully imported ${importedMeasurements.length} measurement entries!`);
        fetchMeasurements(selectedWorkId);
      }

    } catch (error) {
      console.error('Error importing from estimate:', error);
      alert('Error importing measurements from estimate');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMeasurement = async (measurement: Partial<MeasurementBookEntry>, isNew: boolean = false) => {
    if (!user) return;

    try {
      setSaving(true);

      if (isNew) {
        const { error } = await supabase
          .schema('estimate')
          .from('measurement_book')
          .insert([{
            ...measurement,
            measured_by: user.email || 'Unknown User'
          }]);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .schema('estimate')
          .from('measurement_book')
          .update(measurement)
          .eq('sr_no', measurement.sr_no);

        if (error) throw error;
      }

      fetchMeasurements(selectedWorkId);
      setEditingRow(null);
      setShowAddForm(false);
      setNewMeasurement({});

    } catch (error) {
      console.error('Error saving measurement:', error);
      alert('Error saving measurement');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMeasurement = async (srNo: number) => {
    if (!confirm('Are you sure you want to delete this measurement?')) return;

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('measurement_book')
        .delete()
        .eq('sr_no', srNo);

      if (error) throw error;
      fetchMeasurements(selectedWorkId);
    } catch (error) {
      console.error('Error deleting measurement:', error);
      alert('Error deleting measurement');
    }
  };

  const calculateQuantity = (units: number, length: number, width: number, height: number) => {
    if (width === 0 && height === 0) {
      return units; // Count only
    } else if (height === 0) {
      return units * length; // Linear
    } else if (width === 0) {
      return units * length; // Linear
    } else {
      return units * length * width * height; // Volume/Area
    }
  };

  const getVarianceStatus = (variance: number) => {
    if (Math.abs(variance) < 0.01) {
      return { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' };
    } else {
      return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100' };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  // Filter measurements
  const filteredMeasurements = measurements.filter(measurement => {
    const matchesSearch = measurement.description_of_items?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         measurement.item_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSubwork = selectedSubworkId === 'all' || measurement.subwork_id === selectedSubworkId;
    return matchesSearch && matchesSubwork;
  });

  if (loading) {
    return <LoadingSpinner text="Loading measurement book..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <div className="px-8 py-6">
          <div className="flex items-center">
            <div className="p-3 bg-white/20 rounded-2xl mr-4 shadow-lg">
              <BookOpen className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                Measurement Book (MB)
              </h1>
              <p className="text-violet-100 text-sm mt-1">Record and manage actual measurements for construction works</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end">
          {/* Work Selection */}
          <div className="flex-1 max-w-md">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Work
            </label>
            <select
              value={selectedWorkId}
              onChange={(e) => setSelectedWorkId(e.target.value)}
              className="block w-full pl-3 pr-8 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 rounded-xl bg-white shadow-lg"
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
          <div className="flex-1 max-w-md relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Measurements
            </label>
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none" style={{top: '28px'}}>
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search by description or item ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 text-sm border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 shadow-lg"
            />
          </div>

          {/* Subwork Filter */}
          <div className="max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter by Subwork
            </label>
            <select
              value={selectedSubworkId}
              onChange={(e) => setSelectedSubworkId(e.target.value)}
              className="block w-full pl-3 pr-8 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 rounded-xl bg-white shadow-lg"
            >
              <option value="all">All Subworks</option>
              {estimateData?.subworks.map((subwork) => (
                <option key={subwork.subworks_id} value={subwork.subworks_id}>
                  {subwork.subworks_name}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={importFromEstimate}
              disabled={!selectedWorkId || saving}
              className="inline-flex items-center px-4 py-3 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-300 transition-all duration-300 disabled:opacity-50"
            >
              <Import className="w-4 h-4 mr-2" />
              Import from Estimate
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              disabled={!selectedWorkId}
              className="inline-flex items-center px-4 py-3 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-violet-300 transition-all duration-300 disabled:opacity-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Measurement
            </button>
          </div>
        </div>
      </div>

      {/* Selected Work Info */}
      {estimateData && (
        <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-indigo-100 rounded-2xl border border-indigo-200 p-4 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-semibold text-indigo-900">
                {estimateData.work.works_id} - {estimateData.work.work_name}
              </h3>
              <p className="text-sm text-indigo-700 mt-1">
                Division: {estimateData.work.division || 'N/A'} | Status: {estimateData.work.status}
              </p>
              <div className="flex items-center mt-2 text-sm text-indigo-600">
                <Calculator className="w-4 h-4 mr-1" />
                <span>Total Measurements: {filteredMeasurements.length}</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-indigo-700">Total Subworks: {estimateData.subworks.length}</p>
              <p className="text-sm text-indigo-700">
                Total Items: {Object.values(estimateData.subworkItems).flat().length}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Measurement Book Table */}
      {selectedWorkId && (
        <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-violet-500 to-purple-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-2 bg-white/20 rounded-lg mr-3">
                  <FileSpreadsheet className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white">Measurement Book Entries</h3>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-white text-sm">
                  Showing {filteredMeasurements.length} entries
                </span>
                <button
                  onClick={() => fetchMeasurements(selectedWorkId)}
                  className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                >
                  <RefreshCw className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </div>

          {filteredMeasurements.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-slate-100">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Sr No
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Description
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Units
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Length
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Width
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Height
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Est. Qty
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Actual Qty
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Variance
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Unit
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                      Measured By
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMeasurements.map((measurement) => {
                    const isEditing = editingRow === measurement.sr_no;
                    const varianceStatus = getVarianceStatus(measurement.variance);
                    const VarianceIcon = varianceStatus.icon;

                    return (
                      <tr key={measurement.sr_no} className="hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 transition-all duration-200">
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 border-r border-gray-200">
                          {measurement.measurement_sr_no}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-900 border-r border-gray-200 max-w-xs">
                          {isEditing ? (
                            <textarea
                              value={measurement.description_of_items}
                              onChange={(e) => {
                                const updated = measurements.map(m => 
                                  m.sr_no === measurement.sr_no 
                                    ? { ...m, description_of_items: e.target.value }
                                    : m
                                );
                                setMeasurements(updated);
                              }}
                              className="w-full p-1 text-xs border border-gray-300 rounded resize-none"
                              rows={2}
                            />
                          ) : (
                            <div className="text-xs line-clamp-2">{measurement.description_of_items}</div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                          {isEditing ? (
                            <input
                              type="number"
                              value={measurement.no_of_units}
                              onChange={(e) => {
                                const updated = measurements.map(m => 
                                  m.sr_no === measurement.sr_no 
                                    ? { ...m, no_of_units: parseFloat(e.target.value) || 0 }
                                    : m
                                );
                                setMeasurements(updated);
                              }}
                              className="w-16 p-1 text-xs border border-gray-300 rounded text-center"
                              step="1"
                            />
                          ) : (
                            measurement.no_of_units
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                          {isEditing ? (
                            <input
                              type="number"
                              value={measurement.length}
                              onChange={(e) => {
                                const updated = measurements.map(m => 
                                  m.sr_no === measurement.sr_no 
                                    ? { ...m, length: parseFloat(e.target.value) || 0 }
                                    : m
                                );
                                setMeasurements(updated);
                              }}
                              className="w-20 p-1 text-xs border border-gray-300 rounded text-center"
                              step="0.001"
                            />
                          ) : (
                            measurement.length.toFixed(3)
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                          {isEditing ? (
                            <input
                              type="number"
                              value={measurement.width_breadth}
                              onChange={(e) => {
                                const updated = measurements.map(m => 
                                  m.sr_no === measurement.sr_no 
                                    ? { ...m, width_breadth: parseFloat(e.target.value) || 0 }
                                    : m
                                );
                                setMeasurements(updated);
                              }}
                              className="w-20 p-1 text-xs border border-gray-300 rounded text-center"
                              step="0.001"
                            />
                          ) : (
                            measurement.width_breadth.toFixed(3)
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                          {isEditing ? (
                            <input
                              type="number"
                              value={measurement.height_depth}
                              onChange={(e) => {
                                const updated = measurements.map(m => 
                                  m.sr_no === measurement.sr_no 
                                    ? { ...m, height_depth: parseFloat(e.target.value) || 0 }
                                    : m
                                );
                                setMeasurements(updated);
                              }}
                              className="w-20 p-1 text-xs border border-gray-300 rounded text-center"
                              step="0.001"
                            />
                          ) : (
                            measurement.height_depth.toFixed(3)
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-blue-600 border-r border-gray-200">
                          {measurement.estimated_quantity.toFixed(3)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-green-600 border-r border-gray-200">
                          {measurement.actual_quantity.toFixed(3)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm border-r border-gray-200">
                          <div className="flex items-center">
                            <VarianceIcon className={`w-4 h-4 mr-1 ${varianceStatus.color}`} />
                            <span className={`font-medium ${measurement.variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {measurement.variance >= 0 ? '+' : ''}{measurement.variance.toFixed(3)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900 border-r border-gray-200">
                          {measurement.unit}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 border-r border-gray-200">
                          {measurement.measured_by}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex items-center space-x-1">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSaveMeasurement(measurement)}
                                  disabled={saving}
                                  className="text-green-600 hover:text-green-800 p-1 rounded"
                                  title="Save"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingRow(null);
                                    fetchMeasurements(selectedWorkId);
                                  }}
                                  className="text-gray-600 hover:text-gray-800 p-1 rounded"
                                  title="Cancel"
                                >
                                  ✕
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingRow(measurement.sr_no)}
                                  className="text-blue-600 hover:text-blue-800 p-1 rounded"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMeasurement(measurement.sr_no)}
                                  className="text-red-600 hover:text-red-800 p-1 rounded"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-violet-100 to-purple-200 rounded-2xl flex items-center justify-center mb-4">
                <BookOpen className="h-10 w-10 text-violet-600" />
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No measurements found</h3>
              <p className="mt-1 text-sm text-gray-500">
                {selectedWorkId 
                  ? 'Import measurements from estimate or add new measurements manually.'
                  : 'Select a work to view and manage measurements.'
                }
              </p>
              {selectedWorkId && (
                <div className="mt-6 flex justify-center space-x-3">
                  <button
                    onClick={importFromEstimate}
                    disabled={saving}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-lg text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-emerald-300 transition-all duration-300"
                  >
                    <Import className="w-4 h-4 mr-2" />
                    Import from Estimate
                  </button>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-lg text-sm font-semibold rounded-2xl text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-violet-300 transition-all duration-300"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Measurement
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Measurement Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-4xl shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add New Measurement</h3>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewMeasurement({});
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  ✕
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subwork *
                  </label>
                  <select
                    value={newMeasurement.subwork_id || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, subwork_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                  >
                    <option value="">Select Subwork</option>
                    {estimateData?.subworks.map((subwork) => (
                      <option key={subwork.subworks_id} value={subwork.subworks_id}>
                        {subwork.subworks_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Item *
                  </label>
                  <select
                    value={newMeasurement.item_id || ''}
                    onChange={(e) => {
                      const selectedItem = Object.values(estimateData?.subworkItems || {})
                        .flat()
                        .find(item => item.id === e.target.value);
                      
                      setNewMeasurement({
                        ...newMeasurement, 
                        item_id: e.target.value,
                        description_of_items: selectedItem?.description_of_item || '',
                        unit: selectedItem?.ssr_unit || '',
                        estimated_quantity: selectedItem?.ssr_quantity || 0
                      });
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                    disabled={!newMeasurement.subwork_id}
                  >
                    <option value="">Select Item</option>
                    {newMeasurement.subwork_id && estimateData?.subworkItems[newMeasurement.subwork_id]?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.description_of_item}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description of Items *
                  </label>
                  <textarea
                    value={newMeasurement.description_of_items || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, description_of_items: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                    rows={2}
                    placeholder="Enter description of items"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Units
                  </label>
                  <input
                    type="number"
                    value={newMeasurement.no_of_units || 1}
                    onChange={(e) => setNewMeasurement({...newMeasurement, no_of_units: parseInt(e.target.value) || 1})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Length
                  </label>
                  <input
                    type="number"
                    value={newMeasurement.length || 0}
                    onChange={(e) => setNewMeasurement({...newMeasurement, length: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                    step="0.001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width/Breadth
                  </label>
                  <input
                    type="number"
                    value={newMeasurement.width_breadth || 0}
                    onChange={(e) => setNewMeasurement({...newMeasurement, width_breadth: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                    step="0.001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Height/Depth
                  </label>
                  <input
                    type="number"
                    value={newMeasurement.height_depth || 0}
                    onChange={(e) => setNewMeasurement({...newMeasurement, height_depth: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                    step="0.001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Estimated Quantity
                  </label>
                  <input
                    type="number"
                    value={newMeasurement.estimated_quantity || 0}
                    onChange={(e) => setNewMeasurement({...newMeasurement, estimated_quantity: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                    step="0.001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={newMeasurement.unit || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, unit: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                    placeholder="Enter unit"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Variance Reason (if any)
                  </label>
                  <textarea
                    value={newMeasurement.variance_reason || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, variance_reason: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-violet-500 focus:border-violet-500"
                    rows={2}
                    placeholder="Enter reason for variance (optional)"
                  />
                </div>

                {/* Calculated Values Display */}
                <div className="md:col-span-2 bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Calculated Values:</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Actual Quantity:</span>
                      <span className="ml-2 font-medium text-green-600">
                        {calculateQuantity(
                          newMeasurement.no_of_units || 1,
                          newMeasurement.length || 0,
                          newMeasurement.width_breadth || 0,
                          newMeasurement.height_depth || 0
                        ).toFixed(3)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Variance:</span>
                      <span className={`ml-2 font-medium ${
                        (calculateQuantity(
                          newMeasurement.no_of_units || 1,
                          newMeasurement.length || 0,
                          newMeasurement.width_breadth || 0,
                          newMeasurement.height_depth || 0
                        ) - (newMeasurement.estimated_quantity || 0)) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(calculateQuantity(
                          newMeasurement.no_of_units || 1,
                          newMeasurement.length || 0,
                          newMeasurement.width_breadth || 0,
                          newMeasurement.height_depth || 0
                        ) - (newMeasurement.estimated_quantity || 0)).toFixed(3)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Unit:</span>
                      <span className="ml-2 font-medium">{newMeasurement.unit || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewMeasurement({});
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveMeasurement({
                    ...newMeasurement,
                    work_id: selectedWorkId,
                    measurement_sr_no: measurements.length + 1
                  }, true)}
                  disabled={!newMeasurement.subwork_id || !newMeasurement.item_id || !newMeasurement.description_of_items || saving}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-violet-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2 inline-block" />
                      Add Measurement
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeasurementBook;