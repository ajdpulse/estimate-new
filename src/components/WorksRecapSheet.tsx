-bold">
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
