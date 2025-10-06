import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, TaxEntry, RecapCalculations } from '../types';
import { Plus, Trash2, Save, Check } from 'lucide-react';

interface WorksRecapSheetProps {
  workId: string;
  onCalculationsChange?: (calculations: RecapCalculations, taxes: TaxEntry[]) => void;
  onSave?: (calculations: RecapCalculations, taxes: TaxEntry[]) => void;
  readonly?: boolean;
  unitInputs?: { [subworkId: string]: number };
  onUnitChange?: (subworkId: string, value: number) => void;
  setShowPdfModal?: (value: boolean) => void;
}

const WorksRecapSheet: React.FC<WorksRecapSheetProps> = ({
  workId,
  onCalculationsChange,
  onSave,
  readonly = false,
  unitInputs: externalUnitInputs,
  onUnitChange,
  setShowPdfModal, 
}) => {
  const [work, setWork] = useState<Work | null>(null);
  const [subworks, setSubworks] = useState<SubWork[]>([]);
  const [subworkItems, setSubworkItems] = useState<{ [subworkId: string]: SubworkItem[] }>({});
  const [loading, setLoading] = useState(true);
  const [taxes, setTaxes] = useState<TaxEntry[]>([
    { id: '1', name: 'GST', percentage: 18, applyTo: 'part_b' },
  ]);
  const [calculations, setCalculations] = useState<RecapCalculations | null>(null);
  const [saved, setSaved] = useState(false);

  const [localUnitInputs, setLocalUnitInputs] = useState<{ [subworkId: string]: number }>({});
  const unitInputs = externalUnitInputs ?? localUnitInputs;

  const handleUnitChange = (subworkId: string, value: string) => {
    const num = parseFloat(value) || 0;
    if (onUnitChange) {
      onUnitChange(subworkId, num);
    } else {
      setLocalUnitInputs(prev => ({ ...prev, [subworkId]: num }));
    }
    setSaved(false);
  };

  useEffect(() => {
    if (workId) fetchWorkData();
  }, [workId]);

  useEffect(() => {
    if (work && subworks.length > 0) calculateRecap();
  }, [work, subworks, subworkItems, taxes, unitInputs]);

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

    // Check if recap_json exists and parse it
    if (workData?.recap_json) {
      const recapJsonData = JSON.parse(workData.recap_json);

      setWork(recapJsonData.work || workData);

      if (recapJsonData.subworks) {
        setSubworks(recapJsonData.subworks);
      } else {
        setSubworks([]);
      }

      if (recapJsonData.subworkItems) {
        setSubworkItems(recapJsonData.subworkItems);
      } else {
        setSubworkItems({});
      }

      if (recapJsonData.taxes) {
        setTaxes(recapJsonData.taxes);
      } else {
        setTaxes([{ id: '1', name: 'GST', percentage: 18, applyTo: 'part_b' }]);
      }

      if (recapJsonData.unitInputs) {
        setLocalUnitInputs(recapJsonData.unitInputs);
      } else {
        setLocalUnitInputs({});
      }
    } else {
      // If no recap_json, fallback to normal fetching
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
    }
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
      const subworkTotal = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
      const inputUnit = unitInputs[subwork.subworks_id] ?? (Number(subwork.unit) || 1);
      const rowTotal = subworkTotal * inputUnit;
      const isPartA = items.some(item => item.category === 'With GST' || item.category === 'materials');
      const isPartB = items.some(item => item.category === 'Without GST' || !item.category);

      if (isPartA) partASubtotal += rowTotal;
      if (isPartB) partBSubtotal += rowTotal;
    });

    const calculateTaxes = (subtotal: number, applyToPart: 'part_a' | 'part_b') => {
      const applicableTaxes = taxes.filter(
        tax => tax.applyTo === applyToPart || tax.applyTo === 'both'
      );
      const taxAmounts: { [taxId: string]: number } = {};
      applicableTaxes.forEach(tax => {
        taxAmounts[tax.id] = (subtotal * tax.percentage) / 100;
      });
      return taxAmounts;
    };

    const partATaxes = calculateTaxes(partASubtotal, 'part_a');
    const partBTaxes = calculateTaxes(partBSubtotal, 'part_b');
    const partATaxTotal = Object.values(partATaxes).reduce((sum, val) => sum + val, 0);
    const partBTaxTotal = Object.values(partBTaxes).reduce((sum, val) => sum + val, 0);

    const partATotal = partASubtotal + partATaxTotal;
    const partBTotal = partBSubtotal + partBTaxTotal;

    const contingencies = partBTotal * 0.005;
    const inspectionCharges = partBTotal * 0.005;
    const dprCharges = Math.min(partBTotal * 0.05, 100000);

    const grandTotal = partBTotal + dprCharges + partATotal;

    const calculationsResult: RecapCalculations = {
      partA: { subtotal: partASubtotal, taxes: partATaxes, total: partATotal },
      partB: { subtotal: partBSubtotal, taxes: partBTaxes, total: partBTotal },
      additionalCharges: { contingencies, inspectionCharges, dprCharges },
      grandTotal,
    };

    setCalculations(calculationsResult);
    if (onCalculationsChange) onCalculationsChange(calculationsResult, taxes);
  };

  const addTax = () => {
    const newTax: TaxEntry = {
      id: Date.now().toString(),
      name: 'New Tax',
      percentage: 0,
      applyTo: 'both',
    };
    setTaxes([...taxes, newTax]);
    setSaved(false);
  };

  const updateTax = (id: string, field: keyof TaxEntry, value: any) => {
    setTaxes(taxes.map(tax => (tax.id === id ? { ...tax, [field]: value } : tax)));
    setSaved(false);
  };

  const removeTax = (id: string) => {
    setTaxes(taxes.filter(tax => tax.id !== id));
    setSaved(false);
  };

  const handleSave = async () => {
    if (calculations && onSave) {
      onSave(calculations, taxes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    try {
      // 🟢 Step 1: Fetch 'type' from works table
      const { data: workTypeData, error: typeError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', workId)
        .single();

      if (typeError) throw typeError;

      const fetchedType = workTypeData?.type ?? null;
      const fetchedWorkName = workTypeData?.work_name ?? null;

      // 🟢 Step 2: Prepare recap data with fetched type
      const recapData = {
        workId,
        work,
        type: fetchedType, // ✅ use fetched type here
        work_name: fetchedWorkName,
        subworks,
        subworkItems,
        taxes,
        calculations,
        unitInputs,
        savedAt: new Date().toISOString(),
      };

      // 🟢 Step 3: Update works table with recap JSON
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .upsert(
          [
            {
              works_id: workId,
              type: fetchedType, // ✅ add this line
              work_name: fetchedWorkName, // ✅ add this line
              recap_json: JSON.stringify(recapData),
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: 'works_id' }
        );


      if (error) throw error;
      console.log('✅ Recap data is updated');
      setShowPdfModal?.(false);
    } catch (error) {
      console.error('❌ Error saving recap data to Supabase:', error);
    }
  };

  const getPartASubworks = () => {
    return subworks.filter(subwork => {
      const items = subworkItems[subwork.subworks_id] || [];
      return items.some(item => item.category === 'With GST' || item.category === 'materials');
    });
  };

  const getPartBSubworks = () => {
    return subworks.filter(subwork => {
      const items = subworkItems[subwork.subworks_id] || [];
      return items.some(item => item.category === 'Without GST' || !item.category);
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
      {/* Work Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Works Recap Sheet</h2>
        <div className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Work:</span> {work.work_name}
          </p>
          <p>
            <span className="font-medium">Fund Head:</span> {work.fund_head || 'N/A'}
          </p>
          <p>
            <span className="font-medium">Village:</span> {work.village}
          </p>
        </div>
      </div>

      {/* Tax Configuration */}
      {!readonly && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Tax Configuration</h3>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSave}
                disabled={!calculations}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saved ? (
                  <>
                    <Check className="w-4 h-4 mr-1" /> Saved
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" /> Save
                  </>
                )}
              </button>
              <button
                onClick={addTax}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Tax
              </button>
            </div>
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
      )}

      {/* Recap Table */}
      {calculations && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recapitulation Summary</h3>

            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 min-w-[40px] text-center">Sr. No</th>
                  <th className="border border-gray-300 p-3 min-w-[120px]">Type of Work</th>
                  <th className="border border-gray-300 p-3 min-w-[200px]">Item of Work</th>
                  <th className="border border-gray-300 p-3 min-w-[60px] text-right">Unit</th>
                  <th className="border border-gray-300 p-3 min-w-[110px] text-right">Amount per unit(Rs.)</th>
                  <th className="border border-gray-300 p-3 min-w-[110px] text-right">Total Amount (Rs.)</th>
                  <th className="border border-gray-300 p-3 min-w-[100px] text-right">SBM (G) (70%)</th>
                  <th className="border border-gray-300 p-3 min-w-[100px] text-right">15th FC (30%)</th>
                </tr>
              </thead>
              <tbody>
                {/* PART A Rows */}
                <tr className="bg-gray-200 font-bold">
                  <td colSpan={8} className="border border-gray-300 p-3">
                    PART-A: Purchasing Items including GST & all Taxes
                  </td>
                </tr>
                {getPartASubworks().map((subwork, index) => {
                  const items = subworkItems[subwork.subworks_id] || [];
                  const subworkTotalAmount = items.reduce(
                    (sum, item) => sum + (item.total_item_amount || 0),
                    0
                  );
                  const inputUnit = unitInputs[subwork.subworks_id] ?? (Number(subwork.unit) || 1);
                  const totalAmount = inputUnit * subworkTotalAmount;

                  return (
                    <tr key={`part-a-${subwork.subworks_id}`}>
                      <td className="border border-gray-300 p-3 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-3">Solid waste management</td>
                      <td className="border border-gray-300 p-3">{subwork.subworks_name}</td>
                      {readonly ? (
                        <td className="border border-gray-300 p-3 text-right">{inputUnit}</td>
                      ) : (
                        <td className="border border-gray-300 p-3 text-right">
                          <input
                            type="number"
                            className="w-20 px-1 py-1 border border-gray-300 rounded"
                            value={inputUnit}
                            min="0"
                            step="any"
                            onChange={(e) => handleUnitChange(subwork.subworks_id, e.target.value)}
                          />
                        </td>
                      )}
                      <td className="border border-gray-300 p-3 text-right">{subworkTotalAmount.toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{totalAmount.toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.7).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.3).toFixed(0)}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold bg-blue-50">
                  <td colSpan={5} className="border border-gray-300 p-3 text-right">Subtotal - Part A</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partA.subtotal.toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partA.subtotal * 0.7).toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partA.subtotal * 0.3).toFixed(0)}</td>
                </tr>
                {taxes
                  .filter((tax) => tax.applyTo === 'part_a' || tax.applyTo === 'both')
                  .map((tax) => (
                    <tr key={`part-a-tax-${tax.id}`} className="font-semibold">
                      <td colSpan={5} className="border border-gray-300 p-3 text-right">
                        Add {tax.percentage}% {tax.name}
                      </td>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partA.taxes[tax.id] || 0).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{((calculations.partA.taxes[tax.id] || 0) * 0.7).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{((calculations.partA.taxes[tax.id] || 0) * 0.3).toFixed(0)}</td>
                    </tr>
                  ))}
                <tr className="font-bold bg-blue-100">
                  <td colSpan={5} className="border border-gray-300 p-3 text-right">Total of PART - A</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partA.total.toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partA.total * 0.7).toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partA.total * 0.3).toFixed(0)}</td>
                </tr>

                {/* PART B Rows */}
                <tr className="bg-gray-200 font-bold">
                  <td colSpan={8} className="border border-gray-300 p-3">
                    PART-B: Construction works for E-Tendering
                  </td>
                </tr>
                {getPartBSubworks().map((subwork, index) => {
                  const items = subworkItems[subwork.subworks_id] || [];
                  const subworkTotalAmount = items.reduce(
                    (sum, item) => sum + (item.total_item_amount || 0),
                    0
                  );
                  const inputUnit = unitInputs[subwork.subworks_id] ?? (Number(subwork.unit) || 1);
                  const totalAmount = inputUnit * subworkTotalAmount;

                  return (
                    <tr key={`part-b-${subwork.subworks_id}`}>
                      <td className="border border-gray-300 p-3 text-center">{index + 1}</td>
                      <td className="border border-gray-300 p-3">Solid waste management</td>
                      <td className="border border-gray-300 p-3">{subwork.subworks_name}</td>
                      {readonly ? (
                        <td className="border border-gray-300 p-3 text-right">{inputUnit}</td>
                      ) : (
                        <td className="border border-gray-300 p-3 text-right">
                          <input
                            type="number"
                            className="w-20 px-1 py-1 border border-gray-300 rounded"
                            value={inputUnit}
                            min="0"
                            step="any"
                            onChange={(e) => handleUnitChange(subwork.subworks_id, e.target.value)}
                          />
                        </td>
                      )}
                      <td className="border border-gray-300 p-3 text-right">{subworkTotalAmount.toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{totalAmount.toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.7).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{(totalAmount * 0.3).toFixed(0)}</td>
                    </tr>
                  );
                })}
                <tr className="font-bold bg-green-50">
                  <td colSpan={5} className="border border-gray-300 p-3 text-right">Subtotal - Part B</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partB.subtotal.toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partB.subtotal * 0.7).toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partB.subtotal * 0.3).toFixed(0)}</td>
                </tr>
                {taxes
                  .filter((tax) => tax.applyTo === 'part_b' || tax.applyTo === 'both')
                  .map((tax) => (
                    <tr key={`part-b-tax-${tax.id}`} className="font-semibold">
                      <td colSpan={5} className="border border-gray-300 p-3 text-right">
                        Add {tax.percentage}% {tax.name}
                      </td>
                      <td className="border border-gray-300 p-3 text-right">{(calculations.partB.taxes[tax.id] || 0).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{((calculations.partB.taxes[tax.id] || 0) * 0.7).toFixed(0)}</td>
                      <td className="border border-gray-300 p-3 text-right">{((calculations.partB.taxes[tax.id] || 0) * 0.3).toFixed(0)}</td>
                    </tr>
                  ))}
                <tr className="font-bold bg-green-100">
                  <td colSpan={5} className="border border-gray-300 p-3 text-right">Total of PART - B</td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.partB.total.toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partB.total * 0.7).toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.partB.total * 0.3).toFixed(0)}</td>
                </tr>

                {/* Additional Charges & Grand Total */}
                <tr className="font-semibold">
                  <td colSpan={5} className="border border-gray-300 p-3 text-right">
                    DPR charges 5% or 1 Lakh whichever is less
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {calculations.additionalCharges.dprCharges.toFixed(0)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">
                    {calculations.additionalCharges.dprCharges.toFixed(0)}
                  </td>
                  <td className="border border-gray-300 p-3 text-right">0</td>
                </tr>
                <tr className="font-bold bg-yellow-100 text-lg">
                  <td colSpan={5} className="border border-gray-300 p-3 text-right">
                    Gross Total Estimated Amount
                  </td>
                  <td className="border border-gray-300 p-3 text-right">{calculations.grandTotal.toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.grandTotal * 0.7).toFixed(0)}</td>
                  <td className="border border-gray-300 p-3 text-right">{(calculations.grandTotal * 0.3).toFixed(0)}</td>
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