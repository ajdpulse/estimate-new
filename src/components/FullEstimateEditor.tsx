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
  X,
  IndianRupee,
  AlertCircle,
  CheckCircle
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

      const { data: work, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', workId)
        .single();

      if (workError) throw workError;

      setWorkFormData(work);

      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no');

      if (subworksError) throw subworksError;

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

      const { error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .update({
          ...workFormData,
          status: 'draft',
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
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-hidden">
      <div className="h-full flex flex-col bg-white">
        
        {/* Excel-like Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Estimate Editor</h1>
              <p className="text-sm text-gray-500">Complete estimate editing interface</p>
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
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
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
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner text="Loading estimate data..." />
          </div>
        ) : estimateData ? (
          <div className="flex-1 overflow-auto">
            
            {/* Work Details - Editable */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Work Details</h2>
                <button
                  onClick={() => setEditingWork(!editingWork)}
                  className="inline-flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  {editingWork ? 'Cancel' : 'Edit'}
                </button>
              </div>
              
              {editingWork ? (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 w-48">Work Name</td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={workFormData.work_name || ''}
                            onChange={(e) => {
                              setWorkFormData({...workFormData, work_name: e.target.value});
                              setHasChanges(true);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50">Division</td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={workFormData.division || ''}
                            onChange={(e) => {
                              setWorkFormData({...workFormData, division: e.target.value});
                              setHasChanges(true);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50">Total Estimated Cost</td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={workFormData.total_estimated_cost || 0}
                            onChange={(e) => {
                              setWorkFormData({...workFormData, total_estimated_cost: parseFloat(e.target.value) || 0});
                              setHasChanges(true);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50">Status</td>
                        <td className="px-4 py-3">
                          <select
                            value={workFormData.status || 'draft'}
                            onChange={(e) => {
                              setWorkFormData({...workFormData, status: e.target.value as Work['status']});
                              setHasChanges(true);
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="draft">Draft</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                          </select>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full">
                    <tbody className="divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50 w-48">Work ID</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{estimateData.work.works_id}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50">Work Name</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{estimateData.work.work_name}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50">Division</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{estimateData.work.division || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-gray-700 bg-gray-50">Total Estimate</td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-600">{formatCurrency(calculateTotalEstimate())}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Subworks & Items - Editable */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Subworks & Items</h2>
                <button
                  onClick={() => {/* Add new subwork */}}
                  className="inline-flex items-center px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Subwork
                </button>
              </div>
              
              {estimateData.subworks.map((subwork, subworkIndex) => {
                const items = estimateData.subworkItems[subwork.subworks_id] || [];
                
                return (
                  <div key={subwork.subworks_id} className="mb-8">
                    {/* Subwork Header - Editable */}
                    <div className="bg-blue-50 border border-blue-200 rounded-t-lg px-4 py-3 flex items-center justify-between">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={subwork.subworks_name}
                          onChange={(e) => {
                            // Update subwork name
                            setHasChanges(true);
                          }}
                          className="font-semibold text-blue-900 bg-transparent border-none outline-none w-full"
                          placeholder="Subwork name"
                        />
                        <p className="text-sm text-blue-600">{subwork.subworks_id}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {/* Add new item */}}
                          className="text-green-600 hover:text-green-800 p-1 rounded"
                          title="Add Item"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {/* Delete subwork */}}
                          className="text-red-600 hover:text-red-800 p-1 rounded"
                          title="Delete Subwork"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Items Table - Editable */}
                    <div className="bg-white border-l border-r border-b border-gray-200 rounded-b-lg overflow-hidden">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                              Item #
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                              Description
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                              Quantity
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                              Unit
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                              Rate (₹)
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                              Amount (₹)
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Details
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {items.map((item) => {
                            const itemMeasurements = estimateData.measurements[item.id] || [];
                            const itemLeads = estimateData.leads[item.id] || [];
                            const itemMaterials = estimateData.materials[item.id] || [];
                            
                            return (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                                  <input
                                    type="text"
                                    value={item.item_number}
                                    onChange={(e) => {
                                      // Update item number
                                      setHasChanges(true);
                                    }}
                                    className="w-full border-none outline-none bg-transparent"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200 max-w-xs">
                                  <textarea
                                    value={item.description_of_item}
                                    onChange={(e) => {
                                      // Update description
                                      setHasChanges(true);
                                    }}
                                    className="w-full border-none outline-none bg-transparent resize-none"
                                    rows={2}
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                                  <input
                                    type="number"
                                    value={item.ssr_quantity}
                                    onChange={(e) => {
                                      // Update quantity
                                      setHasChanges(true);
                                    }}
                                    className="w-full border-none outline-none bg-transparent text-center"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                                  <input
                                    type="text"
                                    value={item.ssr_unit}
                                    onChange={(e) => {
                                      // Update unit
                                      setHasChanges(true);
                                    }}
                                    className="w-full border-none outline-none bg-transparent text-center"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                                  <input
                                    type="number"
                                    value={item.ssr_rate || 0}
                                    onChange={(e) => {
                                      // Update rate
                                      setHasChanges(true);
                                    }}
                                    className="w-full border-none outline-none bg-transparent text-right"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200">
                                  {(item.total_item_amount || 0).toLocaleString('hi-IN')}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  <div className="flex items-center space-x-2">
                                    {itemMeasurements.length > 0 && (
                                      <button className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 hover:bg-green-200">
                                        <Ruler className="w-3 h-3 mr-1" />
                                        {itemMeasurements.length}
                                      </button>
                                    )}
                                    {itemLeads.length > 0 && (
                                      <button className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 hover:bg-blue-200">
                                        <Truck className="w-3 h-3 mr-1" />
                                        {itemLeads.length}
                                      </button>
                                    )}
                                    {itemMaterials.length > 0 && (
                                      <button className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800 hover:bg-purple-200">
                                        <Package className="w-3 h-3 mr-1" />
                                        {itemMaterials.length}
                                      </button>
                                    )}
                                    <button
                                      onClick={() => {/* Add measurement */}}
                                      className="text-green-600 hover:text-green-800 p-1 rounded"
                                      title="Add Measurement"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-500">
                                  <div className="flex items-center space-x-1">
                                    <button
                                      onClick={() => {/* Edit item */}}
                                      className="text-blue-600 hover:text-blue-800 p-1 rounded"
                                      title="Edit Item"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => {/* Delete item */}}
                                      className="text-red-600 hover:text-red-800 p-1 rounded"
                                      title="Delete Item"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50">
                          <tr>
                            <td colSpan={6} className="px-4 py-3 text-sm font-medium text-gray-900 text-right border-r border-gray-200">
                              Subwork Total:
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-gray-900 border-r border-gray-200">
                              {items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0).toLocaleString('hi-IN')}
                            </td>
                            <td className="px-4 py-3" colSpan={2}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Grand Total */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-green-900">Grand Total:</span>
                  <span className="text-xl font-bold text-green-900">
                    {formatCurrency(calculateTotalEstimate())}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No estimate data found</h3>
              <p className="text-gray-500">Unable to load estimate data for the selected work.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FullEstimateEditor;