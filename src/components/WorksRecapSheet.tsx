import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, TaxEntry, RecapCalculations } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface WorksRecapSheetProps {
  workId: string;
  onCalculationsChange?: (calculations: RecapCalculations, taxes: TaxEntry[]) => void;
}

const WorksRecapSheet: React.FC<WorksRecapSheetProps> = ({ workId, onCalculationsChange }) => {
  const [work, setWork] = useState<Work | null>(null);
  const [subworks, setSubworks] = useState<SubWork[]>([]);
  const [subworkItems, setSubworkItems] = useState<{ [subworkId: string]: SubworkItem[] }>({});
  const [loading, setLoading] = useState(true);
  const [taxes, setTaxes] = useState<TaxEntry[]>([
    { id: '1', name: 'GST', percentage: 18, applyTo: 'part_b' }
  ]);
  const [calculations, setCalculations] = useState<RecapCalculations | null>(null);

  useEffect(() => {
    if (workId) {
      fetchWorkData();
    }
  }, [workId]);

  useEffect(() => {
    if (work && subworks.length > 0) {
      calculateRecap();
    }
  }, [work, subworks, subworkItems, taxes]);

  const fetchWorkData = async () => {
    try {
      setLoading(true);

      const { data: workData, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', workId)
        .single();

      if (workError) throw workError;
      setWork(workData);

      const { data: subworksData, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no');

      if (subworksError) throw subworksError;
      setSubworks(subworksData || []);

      const itemsMap: { [subworkId: string]: SubworkItem[] } = {};
      for (const subwork of subworksData || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id)
          .order('sr_no');

        itemsMap[subwork.subworks_id] = items || [];
      }
      setSubworkItems(itemsMap);

    } catch (error) {
      console.error('Error fetching work data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateRecap = () => {
    let partASubtotal = 0;
    let partBSubtotal = 0;

    subworks.forEach(subwork => {
      const items = subworkItems[subwork.subworks_id] || [];
      items.forEach(item => {
        const amount = item.total_item_amount || 0;
        if (item.category === 'purchasing' || item.category === 'materials') {
          partASubtotal += amount;
        } else {
          partBSubtotal += amount;
        }
      });
    });

    const partATaxes: { [taxId: string]: number } = {};
    const partBTaxes: { [taxId: string]: number } = {};

    taxes.forEach(tax => {
      if (tax.applyTo === 'part_a' || tax.applyTo === 'both') {
        partATaxes[tax.id] = (partASubtotal * tax.percentage) / 100;
      }
      if (tax.applyTo === 'part_b' || tax.applyTo === 'both') {
        partBTaxes[tax.id] = (partBSubtotal * tax.percentage) / 100;
      }
    });

    const partATaxTotal = Object.values(partATaxes).reduce((sum, val) => sum + val, 0);
    const partBTaxTotal = Object.values(partBTaxes).reduce((sum, val) => sum + val, 0);

    const partATotal = partASubtotal + partATaxTotal;
    const partBTotal = partBSubtotal + partBTaxTotal;

    const baseTotal = partATotal + partBTotal;
    const contingencies = baseTotal * 0.005;
    const inspectionCharges = baseTotal * 0.005;
    const dprCharges = Math.min(baseTotal * 0.05, 100000);

    const grandTotal = baseTotal + contingencies + inspectionCharges + dprCharges;

    const calculationsResult: RecapCalculations = {
      partA: {
        subtotal: partASubtotal,
        taxes: partATaxes,
        total: partATotal
      },
      partB: {
        subtotal: partBSubtotal,
        taxes: partBTaxes,
        total: partBTotal
      },
      additionalCharges: {
        contingencies,
        inspectionCharges,
        dprCharges
      },
      grandTotal
    };

    setCalculations(calculationsResult);

    if (onCalculationsChange) {
      onCalculationsChange(calculationsResult, taxes);
    }
  };

  const addTax = () => {
    const newTax: TaxEntry = {
      id: Date.now().toString(),
      name: 'New Tax',
      percentage: 0,
      applyTo: 'both'
    };
    setTaxes([...taxes, newTax]);
  };

  const updateTax = (id: string, field: keyof TaxEntry, value: any) => {
    setTaxes(taxes.map(tax =>
      tax.id === id ? { ...tax, [field]: value } : tax
    ));
  };

  const removeTax = (id: string) => {
    setTaxes(taxes.filter(tax => tax.id !== id));
  };

  const getPartASubworks = () => {
    return subworks.filter(subwork => {
      const items = subworkItems[subwork.subworks_id] || [];
      return items.some(item => item.category === 'purchasing' || item.category === 'materials');
    });
  };

  const getPartBSubworks = () => {
    return subworks.filter(subwork => {
      const items = subworkItems[subwork.subworks_id] || [];
      return items.some(item => item.category === 'construction' || !item.category);
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading recap sheet...</span>
      </div>
    );
  }

  if (!work) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Work not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Works Recap Sheet</h2>
        <div className="space-y-2 text-sm">
          <p><span className="font-medium">Work:</span> {work.work_name}</p>
          <p><span className="font-medium">Fund Head:</span> {work.fund_head || 'N/A'}</p>
          <p><span className="font-medium">Village:</span> {work.village}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Tax Configuration</h3>
          <button
            onClick={addTax}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Tax
          </button>
        </div>

        <div className="space-y-3">
          {taxes.map(tax => (
            <div key={tax.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded">
              <input
                type="text"
                value={tax.name}
                onChange={(e) => updateTax(tax.id, 'name', e.target.value)}
                placeholder="Tax Name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
              />
              <input
                type="number"
                value={tax.percentage}
                onChange={(e) => updateTax(tax.id, 'percentage', parseFloat(e.target.value) || 0)}
                placeholder="Percentage"
                className="w-24 px-3 py-2 border border-gray-300 rounded text-sm"
                step="0.01"
              />
              <select
                value={tax.applyTo}
                onChange={(e) => updateTax(tax.id, 'applyTo', e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded text-sm"
              >
                <option value="part_a">Part A Only</option>
                <option value="part_b">Part B Only</option>
                <option value="both">Both Parts</option>
              </select>
              <button
                onClick={() => removeTax(tax.id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {calculations && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recapitulation Summary</h3>

            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 text-left">Sr. No</th>
                  <th className="border border-gray-300 p-3 text-left">Type of Work</th>
                  <th className="border border-gray-300 p-3 text-left">Item of Work</th>
                  <th className="border border-gray-300 p-3 text-right">Total Amount (Rs.)</th>
                  <th className="border border-gray-300 p-3 text-right">SBM (G) (70%)</th>
                  <th className="border border-gray-300 p-3 text-right">15th FC (30%)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-gray-200 font-bold">
                  <td colSpan={6} className="border border-gray-300 p-3">
                    PART-A: Purchasing Items including GST & all Taxes
                  </td>
                </tr>
                {getPartASubworks().map((subwork, index) => {
                  const items = subworkItems[subwork.subworks_id] || [];
                  const subworkTotal = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);

                  return (
                    <tr key={`part-a-${subwork.subworks_id}`}>
                      <td className="border border-gray-300 p-3 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-3">Solid waste management</td>
                      <td className="border border-gray-300 p-3">{subwork.subworks_name}</td>
                      <td className="border border-gray-300 p-3 text-right">{subworkTotal.toFixed(2)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(subworkTotal * 0.7).toFixed(2)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(subworkTotal * 0.3).toFixed(2)}</td>
                    </tr>
                  );
                })}

                <tr className="font-bold bg-blue-50">
                  <td colSpan={3} className="border border-gray-300 p-3 text-right">Subtotal - Part A</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partA.subtotal.toFixed(2)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partA.subtotal * 0.7).toFixed(2)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partA.subtotal * 0.3).toFixed(2)}</td>
                </tr>

                {taxes.filter(tax => tax.applyTo === 'part_a' || tax.applyTo === 'both').map(tax => (
                  <tr key={`part-a-tax-${tax.id}`} className="font-semibold">
                    <td colSpan={3} className="border border-gray-300 p-3 text-right">
                      Add {tax.percentage}% {tax.name}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">
                      {(calculations.partA.taxes[tax.id] || 0).toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">
                      {((calculations.partA.taxes[tax.id] || 0) * 0.7).toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">
                      {((calculations.partA.taxes[tax.id] || 0) * 0.3).toFixed(2)}
                    </td>
                  </tr>
                ))}

                <tr className="font-bold bg-blue-100">
                  <td colSpan={3} className="border border-gray-300 p-3 text-right">Total of PART - A</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partA.total.toFixed(2)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partA.total * 0.7).toFixed(2)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partA.total * 0.3).toFixed(2)}</td>
                </tr>

                <tr className="bg-gray-200 font-bold">
                  <td colSpan={6} className="border border-gray-300 p-3">
                    PART-B: Construction works for E-Tendering
                  </td>
                </tr>
                {getPartBSubworks().map((subwork, index) => {
                  const items = subworkItems[subwork.subworks_id] || [];
                  const subworkTotal = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);

                  return (
                    <tr key={`part-b-${subwork.subworks_id}`}>
                      <td className="border border-gray-300 p-3 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-3">Solid waste management</td>
                      <td className="border border-gray-300 p-3">{subwork.subworks_name}</td>
                      <td className="border border-gray-300 p-3 text-right">{subworkTotal.toFixed(2)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(subworkTotal * 0.7).toFixed(2)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(subworkTotal * 0.3).toFixed(2)}</td>
                    </tr>
                  );
                })}

                <tr className="font-bold bg-green-50">
                  <td colSpan={3} className="border border-gray-300 p-3 text-right">Subtotal - Part B</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partB.subtotal.toFixed(2)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partB.subtotal * 0.7).toFixed(2)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partB.subtotal * 0.3).toFixed(2)}</td>
                </tr>

                {taxes.filter(tax => tax.applyTo === 'part_b' || tax.applyTo === 'both').map(tax => (
                  <tr key={`part-b-tax-${tax.id}`} className="font-semibold">
                    <td colSpan={3} className="border border-gray-300 p-3 text-right">
                      Add {tax.percentage}% {tax.name}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">
                      {(calculations.partB.taxes[tax.id] || 0).toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">
                      {((calculations.partB.taxes[tax.id] || 0) * 0.7).toFixed(2)}
                    </td>
                    <td className="border border-gray-300 p-3 text-right">
                      {((calculations.partB.taxes[tax.id] || 0) * 0.3).toFixed(2)}
                    </td>
                  </tr>
                ))}

                <tr className="font-bold bg-green-100">
                  <td colSpan={3} className="border border-gray-300 p-3 text-right">Total of PART - B</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partB.total.toFixed(2)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partB.total * 0.7).toFixed(2)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partB.total * 0.3).toFixed(2)}</td>
                </tr>

                <tr className="font-semibold">
                  <td colSpan={3} className="border border-gray-300 p-3 text-right">Add 0.50% Contingencies</td>
                  <td className="border border-gray-300 p-3 text-right">
                    {calculations.additionalCharges.contingencies.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {(calculations.additionalCharges.contingencies * 0.7).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {(calculations.additionalCharges.contingencies * 0.3).toFixed(2)}
                  </td>
                </tr>

                <tr className="font-semibold">
                  <td colSpan={3} className="border border-gray-300 p-3 text-right">Inspection charges 0.50%</td>
                  <td className="border border-gray-300 p-3 text-right">
                    {calculations.additionalCharges.inspectionCharges.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {(calculations.additionalCharges.inspectionCharges * 0.7).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">0.00</td>
                </tr>

                <tr className="font-semibold">
                  <td colSpan={3} className="border border-gray-300 p-3 text-right">
                    DPR charges 5% or 1 Lakh whichever is less
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {calculations.additionalCharges.dprCharges.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {calculations.additionalCharges.dprCharges.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">0.00</td>
                </tr>

                <tr className="font-bold bg-yellow-100 text-lg">
                  <td colSpan={3} className="border border-gray-300 p-3 text-right">
                    Gross Total Estimated Amount
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {calculations.grandTotal.toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {(calculations.grandTotal * 0.7).toFixed(2)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {(calculations.grandTotal * 0.3).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorksRecapSheet;
