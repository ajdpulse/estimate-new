import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ItemMeasurement } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Calculator,
  Ruler,
  FileText,
  AlertCircle
} from 'lucide-react';

interface ItemMeasurementsProps {
  item: {
    id: string;
    sr_no: number;
    description_of_item: string;
    subwork_id: string;
  };
  itemName: string;
  subworkId: string;
  subworkName: string;
  workId?: string; // Optional - indicates if this is from Measurement Book context
  isOpen: boolean;
  onClose: () => void;
}

const ItemMeasurements: React.FC<ItemMeasurementsProps> = ({
  item,
  itemName,
  subworkId,
  subworkName,
  workId,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [measurements, setMeasurements] = useState<ItemMeasurement[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newMeasurement, setNewMeasurement] = useState<Partial<ItemMeasurement>>({
    description_of_items: '',
    no_of_units: 1,
    length: 0,
    width_breadth: 0,
    height_depth: 0,
    unit: 'Cum'
  });

  useEffect(() => {
    if (isOpen) {
      fetchMeasurements();
    }
  }, [isOpen, item.sr_no]);

  const fetchMeasurements = async () => {
    try {
      setLoading(true);

      if (workId) {
        // Measurement Book context - fetch from both tables and merge
        const [originalRes, modifiedRes] = await Promise.all([
          supabase
            .schema('estimate')
            .from('item_measurements')
            .select('*')
            .eq('subwork_item_id', item.sr_no)
            .order('sr_no'),
          supabase
            .schema('estimate')
            .from('measurement_book')
            .select('*')
            .eq('item_id', item.sr_no)
            .eq('subwork_id', subworkId)
            .order('measurement_sr_no')
        ]);

        if (originalRes.error) throw originalRes.error;
        if (modifiedRes.error) throw modifiedRes.error;

        // Merge measurements: prioritize measurement_book data
        const mergedMeasurements = [...(originalRes.data || [])];
        
        (modifiedRes.data || []).forEach(modifiedMeasurement => {
          const existingIndex = mergedMeasurements.findIndex(
            original => original.sr_no === modifiedMeasurement.measurement_sr_no
          );
          
          if (existingIndex >= 0) {
            // Replace existing measurement with modified version
            mergedMeasurements[existingIndex] = {
              ...mergedMeasurements[existingIndex],
              ...modifiedMeasurement,
              sr_no: modifiedMeasurement.measurement_sr_no,
              source: 'measurement_book'
            };
          } else {
            // Add new measurement from measurement_book
            mergedMeasurements.push({
              ...modifiedMeasurement,
              sr_no: modifiedMeasurement.measurement_sr_no,
              subwork_item_id: item.sr_no,
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

        setMeasurements(mergedMeasurements);
      } else {
        // Regular context - fetch from item_measurements only
        const { data, error } = await supabase
          .schema('estimate')
          .from('item_measurements')
          .select('*')
          .eq('subwork_item_id', item.sr_no)
          .order('sr_no');

        if (error) throw error;
        setMeasurements(data || []);
      }
    } catch (error) {
      console.error('Error fetching measurements:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateQuantity = (measurement: Partial<ItemMeasurement>) => {
    const units = measurement.no_of_units || 0;
    const length = measurement.length || 0;
    const width = measurement.width_breadth || 0;
    const height = measurement.height_depth || 0;
    
    // Simple calculation without any conversion logic
    return units * length * width * height;
  };

  const handleAddMeasurement = async () => {
    if (!user || !newMeasurement.description_of_items) return;

    try {
      setSaving(true);
      
      const calculatedQuantity = calculateQuantity(newMeasurement);
      
      const measurementData = {
        subwork_item_id: item.sr_no,
        work_id: workId || '',
        subwork_id: subworkId,
        item_id: item.id,
        description_of_items: newMeasurement.description_of_items,
        no_of_units: newMeasurement.no_of_units || 1,
        length: newMeasurement.length || 0,
        width_breadth: newMeasurement.width_breadth || 0,
        height_depth: newMeasurement.height_depth || 0,
        calculated_quantity: calculatedQuantity,
        estimated_quantity: calculatedQuantity,
        actual_quantity: calculatedQuantity,
        variance: 0,
        unit: newMeasurement.unit || 'Cum'
      };

      if (workId) {
        // Measurement Book context - save to measurement_book table
        const { error } = await supabase
          .schema('estimate')
          .from('measurement_book')
          .insert([{
            ...measurementData,
            measurement_sr_no: measurements.length + 1
          }]);

        if (error) throw error;
      } else {
        // Regular context - save to item_measurements table
        const { error } = await supabase
          .schema('estimate')
          .from('item_measurements')
          .insert([measurementData]);

        if (error) throw error;
      }

      setNewMeasurement({
        description_of_items: '',
        no_of_units: 1,
        length: 0,
        width_breadth: 0,
        height_depth: 0,
        unit: 'Cum'
      });
      
      fetchMeasurements();
    } catch (error) {
      console.error('Error adding measurement:', error);
      alert('Error adding measurement');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMeasurement = async (measurementId: string, updatedData: Partial<ItemMeasurement>) => {
    if (!user) return;

    try {
      setSaving(true);
      
      const calculatedQuantity = calculateQuantity(updatedData);
      
      const measurementData = {
        ...updatedData,
        calculated_quantity: calculatedQuantity,
        estimated_quantity: calculatedQuantity,
        actual_quantity: calculatedQuantity,
        variance: 0
      };

      const measurement = measurements.find(m => m.sr_no.toString() === me,