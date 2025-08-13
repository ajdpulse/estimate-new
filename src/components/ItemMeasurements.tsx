import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ItemMeasurement, ItemRate } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Calculator,
  Ruler
} from 'lucide-react';

interface ItemMeasurementsProps {
  subworkItemId: string;
  itemDescription: string;
  isOpen: boolean;
  onClose: () => void;
}

interface RateGroup {
  rateId: number | null;
  rate: number;
  rateDescription: string;
  totalQuantity: number;
  totalAmount: number;
  unit: string;
}

const ItemMeasurements: React.FC<ItemMeasurementsProps> = ({
  subworkItemId,
  itemDescription,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<ItemMeasurement[]>([]);
  const [availableRates, setAvailableRates] = useState<ItemRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState<ItemMeasurement | null>(null);
  const [newMeasurement, setNewMeasurement] = useState<Partial<ItemMeasurement>>({
    no_of_units: 1,
    length: 0,
    width_breadth: 0,
    height_depth: 0,
    is_deduction: false,
    is_manual_quantity: false
  });

  useEffect(() => {
    if (isOpen && subworkItemId) {
      fetchMeasurements();
      fetchAvailableRates();
    }
  }, [isOpen, subworkItemId]);

  const fetchMeasurements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .select('*')
        .eq('subwork_item_id', subworkItemId)
        .order('measurement_sr_no', { ascending: true });

      if (error) throw error;
      setMeasurements(data || []);
    } catch (error) {
      console.error('Error fetching measurements:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableRates = async () => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('item_rates')
        .select('*')
        .eq('subwork_item_sr_no', subworkItemId)
        .order('sr_no', { ascending: true });

      if (error) throw error;
      setAvailableRates(data || []);
    } catch (error) {
      console.error('Error fetching rates:', error);
    }
  };

  const calculateRateGroups = (): RateGroup[] => {
    const groups: { [key: string]: RateGroup } = {};

    measurements.forEach(measurement => {
      const rateId = measurement.selected_rate_id || null;
      const key = rateId ? `rate_${rateId}` : 'default';
      
      let rate = 660; // Default SSR rate
      let rateDescription = 'Default SSR Rate';
      let unit = 'cum';

      if (rateId) {
        const selectedRate = availableRates.find(r => r.sr_no === rateId);
        if (selectedRate) {
          rate = selectedRate.rate;
          rateDescription = selectedRate.description;
          unit = selectedRate.unit || 'cum';
        }
      }

      if (!groups[key]) {
        groups[key] = {
          rateId,
          rate,
          rateDescription,
          totalQuantity: 0,
          totalAmount: 0,
          unit
        };
      }

      const quantity = measurement.is_manual_quantity 
        ? (measurement.manual_quantity || 0)
        : measurement.calculated_quantity;

      if (measurement.is_deduction) {
        groups[key].totalQuantity -= quantity;
      } else {
        groups[key].totalQuantity += quantity;
      }
    });

    // Calculate amounts
    Object.values(groups).forEach(group => {
      group.totalAmount = group.totalQuantity * group.rate;
    });

    return Object.values(groups).filter(group => group.totalQuantity > 0);
  };

  const handleAddMeasurement = async () => {
    if (!user) return;

    try {
      const calculatedQuantity = newMeasurement.is_manual_quantity
        ? (newMeasurement.manual_quantity || 0)
        : (newMeasurement.no_of_units || 0) * 
          (newMeasurement.length || 0) * 
          (newMeasurement.width_breadth || 0) * 
          (newMeasurement.height_depth || 0);

      const selectedRate = newMeasurement.selected_rate_id 
        ? availableRates.find(r => r.sr_no === newMeasurement.selected_rate_id)
        : null;
      
      const rate = selectedRate ? selectedRate.rate : 660; // Default SSR rate
      const lineAmount = calculatedQuantity * rate;

      const { error } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .insert([{
          ...newMeasurement,
          subwork_item_id: parseInt(subworkItemId),
          calculated_quantity: calculatedQuantity,
          line_amount: lineAmount
        }]);

      if (error) throw error;
      
      setShowAddModal(false);
      setNewMeasurement({
        no_of_units: 1,
        length: 0,
        width_breadth: 0,
        height_depth: 0,
        is_deduction: false,
        is_manual_quantity: false
      });
      fetchMeasurements();
    } catch (error) {
      console.error('Error adding measurement:', error);
    }
  };

  const handleEditMeasurement = (measurement: ItemMeasurement) => {
    setSelectedMeasurement(measurement);
    setNewMeasurement({
      measurement_sr_no: measurement.measurement_sr_no,
      ssr_reference: measurement.ssr_reference,
      works_number: measurement.works_number,
      sub_works_number: measurement.sub_works_number,
      description_of_items: measurement.description_of_items,
      sub_description: measurement.sub_description,
      no_of_units: measurement.no_of_units,
      length: measurement.length,
      width_breadth: measurement.width_breadth,
      height_depth: measurement.height_depth,
      unit: measurement.unit,
      is_deduction: measurement.is_deduction,
      is_manual_quantity: measurement.is_manual_quantity,
      manual_quantity: measurement.manual_quantity,
      selected_rate_id: measurement.selected_rate_id
    });
    setShowEditModal(true);
  };

  const handleUpdateMeasurement = async () => {
    if (!selectedMeasurement) return;

    try {
      const calculatedQuantity = newMeasurement.is_manual_quantity
        ? (newMeasurement.manual_quantity || 0)
        : (newMeasurement.no_of_units || 0) * 
          (newMeasurement.length || 0) * 
          (newMeasurement.width_breadth || 0) * 
          (newMeasurement.height_depth || 0);

      const selectedRate = newMeasurement.selected_rate_id 
        ? availableRates.find(r => r.sr_no === newMeasurement.selected_rate_id)
        : null;
      
      const rate = selectedRate ? selectedRate.rate : 660; // Default SSR rate
      const lineAmount = calculatedQuantity * rate;

      const { error } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .update({
          ...newMeasurement,
          calculated_quantity: calculatedQuantity,
          line_amount: lineAmount
        })
        .eq('id', selectedMeasurement.id);

      if (error) throw error;
      
      setShowEditModal(false);
      setSelectedMeasurement(null);
      setNewMeasurement({
        no_of_units: 1,
        length: 0,
        width_breadth: 0,
        height_depth: 0,
        is_deduction: false,
        is_manual_quantity: false
      });
      fetchMeasurements();
    } catch (error) {
      console.error('Error updating measurement:', error);
    }
  };

  const handleDeleteMeasurement = async (measurement: ItemMeasurement) => {
    if (!confirm('Are you sure you want to delete this measurement?')) {
      return;
    }

    try {
      const { error } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .delete()
        .eq('id', measurement.id);

      if (error) throw error;
      fetchMeasurements();
    } catch (error) {
      console.error('Error deleting measurement:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getTotalQuantity = () => {
    return measurements.reduce((total, measurement) => {
      const quantity = measurement.is_manual_quantity 
        ? (measurement.manual_quantity || 0)
        : measurement.calculated_quantity;
      
      return measurement.is_deduction ? total - quantity : total + quantity;
    }, 0);
  };

  const getTotalAmount = () => {
    return measurements.reduce((total, measurement) => {
      return measurement.is_deduction ? total - measurement.line_amount : total + measurement.line_amount;
    }, 0);
  };

  const rateGroups = calculateRateGroups();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-7xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Item 6 - Detailed Analysis</h3>
            <p className="text-sm text-gray-600 mt-1">{itemDescription}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-6">
            {/* Segregated SSR Information */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-2">SSR Quantity:</h4>
                  <div className="space-y-1">
                    {rateGroups.map((group, index) => (
                      <div key={index}>
                        <p className="text-sm font-semibold text-blue-800">
                          {group.totalQuantity.toFixed(3)} {group.unit}
                        </p>
                        <p className="text-xs text-blue-600">
                          {group.rateDescription}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-500 mt-1">(Auto-calculated from measurements)</p>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-2">SSR Rate:</h4>
                  <div className="space-y-1">
                    {rateGroups.map((group, index) => (
                      <div key={index}>
                        <p className="text-sm font-semibold text-blue-800">
                          ₹{group.rate.toFixed(2)}
                        </p>
                        <p className="text-xs text-blue-600">
                          /{group.unit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-2">SSR Amount:</h4>
                  <div className="space-y-1">
                    {rateGroups.map((group, index) => (
                      <div key={index}>
                        <p className="text-sm font-semibold text-green-600">
                          ₹{group.totalAmount.toFixed(2)}
                        </p>
                        <p className="text-xs text-blue-600">
                          {group.totalQuantity.toFixed(3)} × ₹{group.rate}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Category:</h4>
                  <p className="text-sm text-blue-800">N/A</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button className="border-b-2 border-blue-500 py-2 px-1 text-sm font-medium text-blue-600">
                  <Ruler className="w-4 h-4 inline mr-1" />
                  Measurements ({measurements.length})
                </button>
                <button className="border-transparent py-2 px-1 text-sm font-medium text-gray-500">
                  Lead Charges (0)
                </button>
                <button className="border-transparent py-2 px-1 text-sm font-medium text-gray-500">
                  Materials (0)
                </button>
              </nav>
            </div>

            {/* Summary */}
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                Total Quantity: {getTotalQuantity().toFixed(3)} cum | Total Amount: {formatCurrency(getTotalAmount())}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Measurement
              </button>
            </div>

            {/* Measurements Table */}
            <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
              {measurements.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SR NO</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">DESCRIPTION</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">UNITS</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">LENGTH</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">WIDTH</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">HEIGHT</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">QUANTITY</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">AMOUNT</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {measurements.map((measurement, index) => {
                        const quantity = measurement.is_manual_quantity 
                          ? (measurement.manual_quantity || 0)
                          : measurement.calculated_quantity;
                        
                        return (
                          <tr key={measurement.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {index + 1}
                            </td>
                            <td className="px-4 py-4 text-sm text-gray-900">
                              {measurement.description_of_items || measurement.sub_description || '-'}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {measurement.no_of_units}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {measurement.length}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {measurement.width_breadth}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                              {measurement.height_depth}
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <span className={measurement.is_deduction ? 'text-red-600' : ''}>
                                {measurement.is_deduction ? '-' : ''}{quantity.toFixed(3)} {measurement.unit || 'cum'}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              <span className={measurement.is_deduction ? 'text-red-600' : ''}>
                                {measurement.is_deduction ? '-' : ''}{formatCurrency(measurement.line_amount)}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEditMeasurement(measurement)}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMeasurement(measurement)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
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
                  <Calculator className="mx-auto h-12 w-12 text-gray-300" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No measurements found</h3>
                  <p className="mt-1 text-sm text-gray-500">Add measurements to calculate quantities.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Measurement Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Add Measurement</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={newMeasurement.description_of_items || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, description_of_items: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Selection</label>
                  <select
                    value={newMeasurement.selected_rate_id || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, selected_rate_id: e.target.value ? parseInt(e.target.value) : undefined})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Default SSR Rate (₹660.00)</option>
                    {availableRates.map((rate) => (
                      <option key={rate.sr_no} value={rate.sr_no}>
                        {rate.description} - ₹{rate.rate}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Units</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newMeasurement.no_of_units || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, no_of_units: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newMeasurement.length || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, length: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newMeasurement.width_breadth || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, width_breadth: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newMeasurement.height_depth || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, height_depth: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newMeasurement.is_deduction || false}
                        onChange={(e) => setNewMeasurement({...newMeasurement, is_deduction: e.target.checked})}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Deduction</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newMeasurement.is_manual_quantity || false}
                        onChange={(e) => setNewMeasurement({...newMeasurement, is_manual_quantity: e.target.checked})}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Manual Quantity</span>
                    </label>
                  </div>
                </div>

                {newMeasurement.is_manual_quantity && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manual Quantity</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={newMeasurement.manual_quantity || ''}
                      onChange={(e) => setNewMeasurement({...newMeasurement, manual_quantity: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMeasurement}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Add Measurement
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Measurement Modal */}
        {showEditModal && selectedMeasurement && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
            <div className="relative top-20 mx-auto p-5 border w-11/12 max-w-2xl shadow-lg rounded-md bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Edit Measurement</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={newMeasurement.description_of_items || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, description_of_items: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rate Selection</label>
                  <select
                    value={newMeasurement.selected_rate_id || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, selected_rate_id: e.target.value ? parseInt(e.target.value) : undefined})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Default SSR Rate (₹660.00)</option>
                    {availableRates.map((rate) => (
                      <option key={rate.sr_no} value={rate.sr_no}>
                        {rate.description} - ₹{rate.rate}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Units</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newMeasurement.no_of_units || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, no_of_units: parseInt(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newMeasurement.length || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, length: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newMeasurement.width_breadth || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, width_breadth: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newMeasurement.height_depth || ''}
                    onChange={(e) => setNewMeasurement({...newMeasurement, height_depth: parseFloat(e.target.value) || 0})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newMeasurement.is_deduction || false}
                        onChange={(e) => setNewMeasurement({...newMeasurement, is_deduction: e.target.checked})}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Deduction</span>
                    </label>

                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newMeasurement.is_manual_quantity || false}
                        onChange={(e) => setNewMeasurement({...newMeasurement, is_manual_quantity: e.target.checked})}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Manual Quantity</span>
                    </label>
                  </div>
                </div>

                {newMeasurement.is_manual_quantity && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Manual Quantity</label>
                    <input
                      type="number"
                      min="0"
                      step="0.001"
                      value={newMeasurement.manual_quantity || ''}
                      onChange={(e) => setNewMeasurement({...newMeasurement, manual_quantity: parseFloat(e.target.value) || 0})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateMeasurement}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Update Measurement
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemMeasurements;