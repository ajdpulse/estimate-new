import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { SubworkItem, ItemMeasurement, ItemLead, ItemMaterial } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Calculator,
  Truck,
  Package2,
  X
} from 'lucide-react';

interface ItemMeasurementsProps {
  item: SubworkItem;
  isOpen: boolean;
  onClose: () => void;
  onItemUpdated?: (itemSrNo: number) => void;
}

const ItemMeasurements: React.FC<ItemMeasurementsProps> = ({ 
  item, 
  isOpen, 
  onClose,
  onItemUpdated
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'measurements' | 'leads' | 'materials'>('measurements');
  const [measurements, setMeasurements] = useState<ItemMeasurement[]>([]);
  const [leads, setLeads] = useState<ItemLead[]>([]);
  const [materials, setMaterials] = useState<ItemMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMeasurement, setSelectedMeasurement] = useState<ItemMeasurement | null>(null);
  const [currentItem, setCurrentItem] = useState<SubworkItem>(item);
  const [newMeasurement, setNewMeasurement] = useState<Partial<ItemMeasurement>>({
    no_of_units: 0,
    length: 0,
    width_breadth: 0,
    height_depth: 0
  });
  const [newLead, setNewLead] = useState<Partial<ItemLead>>({
    material: '',
    lead_in_km: 0,
    lead_charges: 0,
    initial_lead_charges: 0
  });
  const [newMaterial, setNewMaterial] = useState<Partial<ItemMaterial>>({
    material_name: '',
    required_quantity: 0,
    rate_per_unit: 0
  });

  useEffect(() => {
    if (isOpen && item.sr_no) {
      fetchData();
    }
  }, [isOpen, item.sr_no, activeTab]);

  useEffect(() => {
    setCurrentItem(item);
  }, [item]);
  const fetchData = async () => {
    try {
      setLoading(true);
      
      if (activeTab === 'measurements') {
        const { data, error } = await supabase
          .schema('estimate')
          .from('item_measurements')
          .select('*')
          .eq('subwork_item_id', currentItem.sr_no)
          .order('measurement_sr_no', { ascending: true });

        if (error) throw error;
        setMeasurements(data || []);
      } else if (activeTab === 'leads') {
        const { data, error } = await supabase
          .schema('estimate')
          .from('item_leads')
          .select('*')
          .eq('subwork_item_id', currentItem.sr_no)
          .order('sr_no', { ascending: true });

        if (error) throw error;
        setLeads(data || []);
      } else if (activeTab === 'materials') {
        const { data, error } = await supabase
          .schema('estimate')
          .from('item_materials')
          .select('*')
          .eq('subwork_item_id', currentItem.sr_no)
          .order('material_name', { ascending: true });

        if (error) throw error;
        setMaterials(data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getNextMeasurementSrNo = async (): Promise<number> => {
    try {
      const { data, error } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .select('measurement_sr_no')
        .eq('subwork_item_id', currentItem.sr_no)
        .order('measurement_sr_no', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      return data && data.length > 0 ? data[0].measurement_sr_no + 1 : 1;
    } catch (error) {
      console.error('Error getting next measurement sr_no:', error);
      return 1;
    }
  };

  const handleAddMeasurement = async () => {
    if (!user) return;

    try {
      const nextSrNo = await getNextMeasurementSrNo();
      const calculatedQuantity = (newMeasurement.no_of_units || 0) * 
                                (newMeasurement.length || 0) * 
                                (newMeasurement.width_breadth || 0) * 
                                (newMeasurement.height_depth || 0);
      
      const lineAmount = calculatedQuantity * currentItem.ssr_rate;

      const { error } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .insert([{
          ...newMeasurement,
          subwork_item_id: currentItem.sr_no,
          measurement_sr_no: nextSrNo,
          calculated_quantity: calculatedQuantity,
          line_amount: lineAmount,
          unit: currentItem.ssr_unit
        }]);

      if (error) throw error;
      
      setShowAddModal(false);
      setNewMeasurement({
        no_of_units: 0,
        length: 0,
        width_breadth: 0,
        height_depth: 0
      });
      
      // Refresh data first, then update SSR quantity
      fetchData();
      
      // Update SSR quantity after adding measurement
      setTimeout(async () => {
        await updateItemSSRQuantity();
      }, 100);
    } catch (error) {
      console.error('Error adding measurement:', error);
    }
  };

  const copyLastMeasurement = () => {
    if (measurements.length > 0) {
      const lastMeasurement = measurements[measurements.length - 1];
      setNewMeasurement({
        description_of_items: lastMeasurement.description_of_items,
        no_of_units: lastMeasurement.no_of_units,
        is_deduction: lastMeasurement.is_deduction || false,
        length: lastMeasurement.length,
        width_breadth: lastMeasurement.width_breadth,
        height_depth: lastMeasurement.height_depth
      });
    }
  };

  const updateItemSSRQuantity = async () => {
    try {
      // Get all measurements for this item
      const { data: allMeasurements, error: fetchError } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .select('calculated_quantity')
        .eq('subwork_item_id', currentItem.sr_no);

      if (fetchError) throw fetchError;

      // Calculate total quantity from all measurements
      const totalQuantity = (allMeasurements || []).reduce((sum, m) => sum + m.calculated_quantity, 0);
      
      // Update the subwork item's SSR quantity and total amount
      const newTotalAmount = totalQuantity * currentItem.ssr_rate;
      
      const { error: updateError } = await supabase
        .schema('estimate')
        .from('subwork_items')
        .update({
          ssr_quantity: totalQuantity,
          total_item_amount: newTotalAmount
        })
        .eq('sr_no', currentItem.sr_no);

      if (updateError) throw updateError;
      
      // Update the local current item object to reflect changes
      setCurrentItem(prev => ({
        ...prev,
        ssr_quantity: totalQuantity,
        total_item_amount: newTotalAmount
      }));
      
      // Notify parent component to refresh the item data
      if (onItemUpdated) {
        onItemUpdated(currentItem.sr_no);
      }
      
      console.log(`Updated SSR quantity to ${totalQuantity} for item ${currentItem.sr_no}`);
      
    } catch (error) {
      console.error('Error updating SSR quantity:', error);
    }
  };

  const handleEditMeasurement = (measurement: ItemMeasurement) => {
    setSelectedMeasurement(measurement);
    setNewMeasurement({
      description_of_items: measurement.description_of_items,
      no_of_units: measurement.no_of_units,
      length: measurement.length,
      width_breadth: measurement.width_breadth,
      height_depth: measurement.height_depth,
      calculated_quantity: measurement.calculated_quantity,
      unit: measurement.unit || '',
      is_deduction: measurement.is_deduction || false
    });
    setShowEditModal(true);
  };

  const handleUpdateMeasurement = async () => {
    if (!selectedMeasurement || !user) return;

    try {
      const calculatedQuantity = (newMeasurement.no_of_units || 0) * 
                                (newMeasurement.length || 0) * 
                                (newMeasurement.width_breadth || 0) * 
                                (newMeasurement.height_depth || 0);
      
      const lineAmount = calculatedQuantity * currentItem.ssr_rate;

      const { error } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .update({
          description_of_items: newMeasurement.description_of_items,
          no_of_units: newMeasurement.no_of_units,
          length: newMeasurement.length,
          width_breadth: newMeasurement.width_breadth,
          height_depth: newMeasurement.height_depth,
          calculated_quantity: calculatedQuantity,
          line_amount: lineAmount,
          unit: currentItem.ssr_unit
        })
        .eq('subwork_item_id', selectedMeasurement.subwork_item_id)
        .eq('measurement_sr_no', selectedMeasurement.measurement_sr_no);

      if (error) throw error;
      
      setShowEditModal(false);
      setSelectedMeasurement(null);
      setNewMeasurement({
        no_of_units: 0,
        length: 0,
        width_breadth: 0,
        height_depth: 0
      });
      
      // Refresh data first, then update SSR quantity
      fetchData();
      
      // Update SSR quantity after editing measurement
      setTimeout(async () => {
        await updateItemSSRQuantity();
      }, 100);
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
        .eq('subwork_item_id', measurement.subwork_item_id)
        .eq('measurement_sr_no', measurement.measurement_sr_no);

      if (error) throw error;
      
      fetchData();
      
      // Update SSR quantity after deletion
      setTimeout(async () => {
        await updateItemSSRQuantity();
      }, 100);
    } catch (error) {
      console.error('Error deleting measurement:', error);
    }
  };

  const handleAddLead = async () => {
    if (!newLead.material || !user) return;

    try {
      const netLeadCharges = (newLead.lead_charges || 0) - (newLead.initial_lead_charges || 0);

      const { error } = await supabase
        .schema('estimate')
        .from('item_leads')
        .insert([{
          ...newLead,
          subwork_item_id: currentItem.sr_no,
          net_lead_charges: netLeadCharges
        }]);

      if (error) throw error;
      
      setShowAddModal(false);
      setNewLead({
        material: '',
        lead_in_km: 0,
        lead_charges: 0,
        initial_lead_charges: 0
      });
      fetchData();
    } catch (error) {
      console.error('Error adding lead:', error);
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.material_name || !user) return;

    try {
      const totalCost = (newMaterial.required_quantity || 0) * (newMaterial.rate_per_unit || 0);

      const { error } = await supabase
        .schema('estimate')
        .from('item_materials')
        .insert([{
          ...newMaterial,
          subwork_item_id: currentItem.sr_no,
          total_material_cost: totalCost
        }]);

      if (error) throw error;
      
      setShowAddModal(false);
      setNewMaterial({
        material_name: '',
        required_quantity: 0,
        rate_per_unit: 0
      });
      fetchData();
    } catch (error) {
      console.error('Error adding material:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const totalMeasurementQuantity = measurements.reduce((sum, m) => sum + m.calculated_quantity, 0);
  const totalMeasurementAmount = measurements.reduce((sum, m) => sum + m.line_amount, 0);
  const totalLeadCharges = leads.reduce((sum, l) => sum + l.net_lead_charges, 0);
  const totalMaterialCost = materials.reduce((sum, m) => sum + m.total_material_cost, 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-60">
      <div className="relative top-5 mx-auto p-5 border w-11/12 max-w-7xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                Item {item.item_number} - Detailed Analysis
              </h3>
              <p className="text-sm text-gray-500">{item.description_of_item}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Item Summary */}
          <div className="bg-blue-50 rounded-md border border-blue-200 p-3 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-700 font-medium">SSR Quantity:</span>
                <p className="text-blue-900" id="ssr-quantity-display">{currentItem.ssr_quantity.toFixed(3)} {currentItem.ssr_unit}</p>
                <p className="text-xs text-blue-600">(Auto-calculated from measurements)</p>
              </div>
              <div>
                <span className="text-blue-700 font-medium">SSR Rate:</span>
                <p className="text-blue-900">₹{currentItem.ssr_rate.toFixed(2)}</p>
              </div>
              <div>
                <span className="text-blue-700 font-medium">SSR Amount:</span>
                <p className="text-blue-900">{formatCurrency(currentItem.total_item_amount)}</p>
                <p className="text-xs text-blue-600">(Quantity × Rate)</p>
              </div>
              <div>
                <span className="text-blue-700 font-medium">Category:</span>
                <p className="text-blue-900">{currentItem.category || '-'}</p>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
};
  )
}