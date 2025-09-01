import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement, ItemLead, ItemMaterial } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  FileText, 
  Save, 
  Plus, 
  Edit2, 
  Trash2, 
  Calculator,
  Package,
  Ruler,
  Truck,
  Settings,
  ChevronDown,
  ChevronRight,
  IndianRupee,
  AlertCircle,
  CheckCircle,
  X
} from 'lucide-react';

interface FullEstimateEditorProps {
  workId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

interface EstimateData {
  work: Work;
  subworks: SubWork[];
  subworkItems: { [subworkId: string]: SubworkItem[] };
  measurements: { [itemId: string]: ItemMeasurement[] };
  leads: { [itemId: string]: ItemLead[] };
  materials: { [itemId: string]: ItemMaterial[] };
}

const FullEstimateEditor: React.FC<FullEstimateEditorProps> = ({
  workId,
  isOpen,
  onClose,
  onSave
}) => {
  const { user } = useAuth();
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSubworks, setExpandedSubworks] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingWork, setEditingWork] = useState(false);
  const [workFormData, setWorkFormData] = useState<Partial<Work>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen && workId) {
      fetchEstimateData();
    }
  }, [isOpen, workId]);

  const fetchEstimateData = async () => {
    try {
      setLoading(true);

      // Fetch work details
      const { data: work, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', workId)
        .single();

      if (workError) throw workError;

      // Initialize work form data
      setWorkFormData(work);

      // Fetch subworks
      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no');

      if (subworksError) throw subworksError;

      // Fetch all related data
      const subworkItems: { [subworkId: string]: SubworkItem[] } = {};
      const measurements: { [itemId: string]: ItemMeasurement[] } = {};
      const leads: { [itemId: string]: ItemLead[] } = {};
      const materials: { [itemId: string]: ItemMaterial[] } = {};

      for (const subwork of subworks || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id)
          .order('sr_no');

        subworkItems[subwork.subworks_id] = items || [];

        // Fetch measurements, leads, and materials for each item
        for (const item of items || []) {
          const [measurementsRes, leadsRes, materialsRes] = await Promise.all([
            supabase.schema('estimate').from('item_measurements').select('*').eq('subwork_item_id', item.sr_no),
            supabase.schema('estimate').from('item_leads').select('*').eq('subwork_item_id', item.sr_no),
            supabase.schema('estimate').from('item_materials').select('*').eq('subwork_item_id', item.sr_no)
          ]);

          measurements[item.id] = measurementsRes.data || [];
          leads[item.id] = leadsRes.data || [];
          materials[item.id] = materialsRes.data || [];
        }
      }

      setEstimateData({
        work,
        subworks: subworks || [],
        subworkItems,
        measurements,
        leads,
        materials
      });

    } catch (error) {
      console.error('Error fetching estimate data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEstimate = async () => {
    if (!estimateData || !user) return;

    try {
      setSaving(true);

      // Update work details
      const { error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .update({
          ...workFormData,
          status: 'draft', // Always save as draft
          updated_at: new Date().toISOString()
        })
        .eq('works_id', workId);

      if (workError) throw workError;

      setHasChanges(false);
      alert('Estimate saved successfully as draft!');
      
      if (onSave) {
        onSave();
      }

    } catch (error) {
      console.error('Error saving estimate:', error);
      alert('Error saving estimate');
    } finally {
      setSaving(false);
    }
  };

  const toggleSubworkExpansion = (subworkId: string) => {
    const newExpanded = new Set(expandedSubworks);
    if (newExpanded.has(subworkId)) {
      newExpanded.delete(subworkId);
    } else {
      newExpanded.add(subworkId);
    }
    setExpandedSubworks(newExpanded);
  };

  const toggleItemExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const calculateTotalEstimate = () => {
    if (!estimateData) return 0;
    
    let total = 0;
    estimateData.subworks.forEach(subwork => {
      const items = estimateData.subworkItems[subwork.subworks_id] || [];
      items.forEach(item => {
        total += item.total_item_amount || 0;
      });
    });
    
    return total;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-7xl shadow-lg rounded-md bg-white min-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl mr-4 shadow-lg">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Full Estimate Editor</h1>
              <p className="text-sm text-gray-500 mt-1">Edit complete estimate as draft</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {hasChanges && (
              <div className="flex items-center text-amber-600 text-sm">
                <AlertCircle className="w-4 h-4 mr-1" />
                Unsaved changes
              </div>
            )}
            
            <button
              onClick={handleSaveEstimate}
              disabled={saving || !hasChanges}
              className="inline-flex items-center px-6 py-3 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300 transition-all duration-300 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Draft
                </>
              )}
            </button>
            
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner text="Loading estimate data..." />
          </div>
        ) : estimateData ? (
          <div className="space-y-6">
            
            {/* Work Details Section */}
            <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-blue-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="p-2 bg-white/20 rounded-lg mr-3">
                      <Settings className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-lg font-semibold text-white">Work Details</h2>
                  </div>
                  <button
                    onClick={() => setEditingWork(!editingWork)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200 hover:scale-105"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    {editingWork ? 'Cancel' : 'Edit Work'}
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {editingWork ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Work Name</label>
                      <input
                        type="text"
                        value={workFormData.work_name || ''}
                        onChange={(e) => {
                          setWorkFormData({...workFormData, work_name: e.target.value});
                          setHasChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Division</label>
                      <input
                        type="text"
                        value={workFormData.division || ''}
                        onChange={(e) => {
                          setWorkFormData({...workFormData, division: e.target.value});
                          setHasChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Total Estimated Cost</label>
                      <input
                        type="number"
                        value={workFormData.total_estimated_cost || 0}
                        onChange={(e) => {
                          setWorkFormData({...workFormData, total_estimated_cost: parseFloat(e.target.value) || 0});
                          setHasChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={workFormData.status || 'draft'}
                        onChange={(e) => {
                          setWorkFormData({...workFormData, status: e.target.value as Work['status']});
                          setHasChanges(true);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Work ID</h3>
                      <p className="text-lg font-bold text-gray-900">{estimateData.work.works_id}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Division</h3>
                      <p className="text-lg font-bold text-gray-900">{estimateData.work.division || 'N/A'}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Total Estimate</h3>
                      <p className="text-lg font-bold text-green-600">{formatCurrency(calculateTotalEstimate())}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Subworks Section */}
            <div className="space-y-4">
              {estimateData.subworks.map((subwork, subworkIndex) => {
                const items = estimateData.subworkItems[subwork.subworks_id] || [];
                const isExpanded = expandedSubworks.has(subwork.subworks_id);
                
                // Color schemes for different subworks
                const colorSchemes = [
                  { gradient: 'from-emerald-500 to-teal-600', bg: 'from-emerald-50 to-teal-100', border: 'border-emerald-200' },
                  { gradient: 'from-purple-500 to-pink-600', bg: 'from-purple-50 to-pink-100', border: 'border-purple-200' },
                  { gradient: 'from-orange-500 to-red-600', bg: 'from-orange-50 to-red-100', border: 'border-orange-200' },
                  { gradient: 'from-indigo-500 to-blue-600', bg: 'from-indigo-50 to-blue-100', border: 'border-indigo-200' },
                  { gradient: 'from-green-500 to-emerald-600', bg: 'from-green-50 to-emerald-100', border: 'border-green-200' }
                ];
                
                const colorScheme = colorSchemes[subworkIndex % colorSchemes.length];

                return (
                  <div key={subwork.subworks_id} className={`bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border ${colorScheme.border} overflow-hidden`}>
                    <div 
                      className={`px-6 py-4 bg-gradient-to-r ${colorScheme.gradient} cursor-pointer`}
                      onClick={() => toggleSubworkExpansion(subwork.subworks_id)}
                    >
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
                              {items.length} items
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center">
                          {isExpanded ? (
                            <ChevronDown className="w-6 h-6 text-white" />
                          ) : (
                            <ChevronRight className="w-6 h-6 text-white" />
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-6">
                        {items.length > 0 ? (
                          <div className="space-y-4">
                            {items.map((item) => {
                              const itemMeasurements = estimateData.measurements[item.id] || [];
                              const itemLeads = estimateData.leads[item.id] || [];
                              const itemMaterials = estimateData.materials[item.id] || [];
                              const isItemExpanded = expandedItems.has(item.id);

                              return (
                                <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden">
                                  <div 
                                    className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors duration-200"
                                    onClick={() => toggleItemExpansion(item.id)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="flex items-center space-x-3 mb-2">
                                          <span className="text-sm font-bold text-gray-500">Item #{item.item_number}</span>
                                          <div className="flex items-center space-x-2">
                                            {itemMeasurements.length > 0 && (
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">
                                                <Ruler className="w-3 h-3 mr-1" />
                                                {itemMeasurements.length} measurements
                                              </span>
                                            )}
                                            {itemLeads.length > 0 && (
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                                <Truck className="w-3 h-3 mr-1" />
                                                {itemLeads.length} leads
                                              </span>
                                            )}
                                            {itemMaterials.length > 0 && (
                                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                                                <Package className="w-3 h-3 mr-1" />
                                                {itemMaterials.length} materials
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        
                                        <h4 className="text-base font-bold text-gray-900 mb-2">
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
                                            <span>Total: {formatCurrency(item.total_item_amount || 0)}</span>
                                          </div>
                                          <div className="flex items-center text-gray-600">
                                            {isItemExpanded ? (
                                              <ChevronDown className="w-4 h-4 mr-2 text-gray-400" />
                                            ) : (
                                              <ChevronRight className="w-4 h-4 mr-2 text-gray-400" />
                                            )}
                                            <span>Details</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {isItemExpanded && (
                                    <div className="p-4 bg-white border-t border-gray-200">
                                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        
                                        {/* Measurements */}
                                        <div>
                                          <h5 className="font-bold text-gray-900 mb-3 flex items-center">
                                            <Ruler className="w-4 h-4 mr-2 text-green-500" />
                                            Measurements ({itemMeasurements.length})
                                          </h5>
                                          {itemMeasurements.length > 0 ? (
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                              {itemMeasurements.map((measurement) => (
                                                <div key={measurement.id} className="p-2 bg-green-50 rounded-lg text-xs">
                                                  <p className="font-medium">{measurement.description_of_items}</p>
                                                  <p className="text-gray-600">
                                                    Qty: {measurement.calculated_quantity} {measurement.unit}
                                                  </p>
                                                  <p className="text-green-600 font-bold">
                                                    Amount: {formatCurrency(measurement.line_amount)}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-gray-500 text-sm">No measurements</p>
                                          )}
                                        </div>

                                        {/* Leads */}
                                        <div>
                                          <h5 className="font-bold text-gray-900 mb-3 flex items-center">
                                            <Truck className="w-4 h-4 mr-2 text-blue-500" />
                                            Lead Charges ({itemLeads.length})
                                          </h5>
                                          {itemLeads.length > 0 ? (
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                              {itemLeads.map((lead) => (
                                                <div key={lead.id} className="p-2 bg-blue-50 rounded-lg text-xs">
                                                  <p className="font-medium">{lead.material}</p>
                                                  <p className="text-gray-600">
                                                    Lead: {lead.lead_in_km} km
                                                  </p>
                                                  <p className="text-blue-600 font-bold">
                                                    Charges: {formatCurrency(lead.net_lead_charges)}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-gray-500 text-sm">No lead charges</p>
                                          )}
                                        </div>

                                        {/* Materials */}
                                        <div>
                                          <h5 className="font-bold text-gray-900 mb-3 flex items-center">
                                            <Package className="w-4 h-4 mr-2 text-purple-500" />
                                            Materials ({itemMaterials.length})
                                          </h5>
                                          {itemMaterials.length > 0 ? (
                                            <div className="space-y-2 max-h-40 overflow-y-auto">
                                              {itemMaterials.map((material) => (
                                                <div key={material.id} className="p-2 bg-purple-50 rounded-lg text-xs">
                                                  <p className="font-medium">{material.material_name}</p>
                                                  <p className="text-gray-600">
                                                    Qty: {material.required_quantity} {material.unit}
                                                  </p>
                                                  <p className="text-purple-600 font-bold">
                                                    Cost: {formatCurrency(material.total_material_cost)}
                                                  </p>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="text-gray-500 text-sm">No materials</p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Package className="mx-auto h-12 w-12 text-gray-300" />
                            <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
                            <p className="mt-1 text-sm text-gray-500">
                              No items available in this subwork.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No estimate data found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Unable to load estimate data for the selected work.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default FullEstimateEditor;