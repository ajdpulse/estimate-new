{/* Page 3: Recapitulation Sheet */}
              <div className="pdf-page bg-white p-8 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                <PageHeader pageNumber={3} />

                <div className="flex-1">
                  <div className="text-center mb-6">
                    <p className="text-sm">Fund Head :- {estimateData.work.fund_head || 'SBM (G.) Phase-II & 15th Finance Commission'}</p>
                    <p className="text-sm font-semibold">NAME OF WORK: {estimateData.work.work_name}</p>
                    <p className="text-sm">Village :- Nakoda, GP :- Nakoda, Tah :- Chandrapur</p>
                    <h3 className="text-lg font-bold mt-4">RECAPITULATION SHEET</h3>
                  </div>

                  <table className="w-full border-collapse border border-black text-xs mb-6">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-black p-2 text-center">Sr. No</th>
                        <th className="border border-black p-2">Type of work</th>
                        <th className="border border-black p-2">Item of Work</th>
                        <th className="border border-black p-2">No. of unit</th>
                        <th className="border border-black p-2">Amount per unit (Rs.)</th>
                        <th className="border border-black p-2">Total Amount (Rs.)</th>
                        <th className="border border-black p-2">SBM (G) (70%) (Rs.)</th>
                        <th className="border border-black p-2">Convergence-15th Finance Commission (30%) (Rs.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* PART-A: Purchasing Items including GST & all Taxes */}
                      <tr className="bg-gray-200 font-bold">
                        <td colSpan={8} className="border border-black p-2">PART-A :- Purchasing Items including GST & all Taxes</td>
                      </tr>
                      {estimateData.subworks.filter(subwork => {
                        const items = estimateData.subworkItems[subwork.subworks_id] || [];
                        return items.some(item => item.category === 'purchasing' || item.category === 'materials');
                      }).map((subwork, index) => {
                        const items = estimateData.subworkItems[subwork.subworks_id] || [];
                        const subworkTotal = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
                        const unitCount = items.reduce((sum, item) => sum + (item.ssr_quantity || 0), 0);

                        return (
                          <tr key={`part-a-${subwork.subworks_id}`}>
                            <td className="border border-black p-2 text-center">{index + 1}</td>
                            <td className="border border-black p-2">Solid waste management</td>
                            <td className="border border-black p-2">{subwork.subworks_name}</td>
                            <td className="border border-black p-2 text-center">{unitCount}</td>
                            <td className="border border-black p-2 text-right">{subworkTotal > 0 ? (subworkTotal / Math.max(unitCount, 1)).toFixed(2) : '0.00'}</td>
                            <td className="border border-black p-2 text-right">{subworkTotal.toFixed(2)}</td>
                            <td className="border border-black p-2 text-right">{(subworkTotal * 0.7).toFixed(2)}</td>
                            <td className="border border-black p-2 text-right">{(subworkTotal * 0.3).toFixed(2)}</td>
                          </tr>
                        );
                      })}

                      {/* Total of PART-A */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Total of PART - A</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.4).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.4 * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.4 * 0.3).toFixed(2)}</td>
                      </tr>

                      {/* PART-B: Construction works for E-Tendering */}
                      <tr className="bg-gray-200 font-bold">
                        <td colSpan={8} className="border border-black p-2">PART- B:- Construction works for E-Tendering</td>
                      </tr>
                      {estimateData.subworks.filter(subwork => {
                        const items = estimateData.subworkItems[subwork.subworks_id] || [];
                        return items.some(item => item.category === 'construction' || !item.category);
                      }).map((subwork, index) => {
                        const items = estimateData.subworkItems[subwork.subworks_id] || [];
                        const subworkTotal = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
                        const unitCount = items.reduce((sum, item) => sum + (item.ssr_quantity || 0), 0);

                        return (
                          <tr key={`part-b-${subwork.subworks_id}`}>
                            <td className="border border-black p-2 text-center">{index + 1}</td>
                            <td className="border border-black p-2">Solid waste management</td>
                            <td className="border border-black p-2">{subwork.subworks_name}</td>
                            <td className="border border-black p-2 text-center">{unitCount}</td>
                            <td className="border border-black p-2 text-right">{subworkTotal > 0 ? (subworkTotal / Math.max(unitCount, 1)).toFixed(2) : '0.00'}</td>
                            <td className="border border-black p-2 text-right">{subworkTotal.toFixed(2)}</td>
                            <td className="border border-black p-2 text-right">{(subworkTotal * 0.7).toFixed(2)}</td>
                            <td className="border border-black p-2 text-right">{(subworkTotal * 0.3).toFixed(2)}</td>
                          </tr>
                        );
                      })}

                      {/* Total */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Total</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.6).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.6 * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.6 * 0.3).toFixed(2)}</td>
                      </tr>

                      {/* Add 18% GST */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Add 18 % GST</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.6 * 0.18).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.6 * 0.18 * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.6 * 0.18 * 0.3).toFixed(2)}</td>
                      </tr>

                      {/* Total of PART-B */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Total of PART - B</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.6 * 1.18).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.6 * 1.18 * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.6 * 1.18 * 0.3).toFixed(2)}</td>
                      </tr>

                      {/* Add 0.50% Contingencies */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Add 0.50 % Contingencies</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.005).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.005 * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.005 * 0.3).toFixed(2)}</td>
                      </tr>

                      {/* Inspection charges 0.50% */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Inspection charges 0.50%</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.005).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.005 * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">0.00</td>
                      </tr>

                      {/* DPR charges 5% or 1 Lakh whichever is less */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">DPR charges 5% or 1 Lakh whichever is less</td>
                        <td className="border border-black p-2 text-right">{Math.min(calculateTotalEstimate() * 0.05, 100000).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{Math.min(calculateTotalEstimate() * 0.05, 100000).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">0.00</td>
                      </tr>

                      {/* Gross Total Estimated Amount */}
                      <tr className="font-bold bg-gray-100 text-lg">
                        <td colSpan={5} className="border border-black p-2 text-right">Gross Total Estimated Amount</td>
                        <td className="border border-black p-2 text-right">{calculateTotalEstimate().toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{(calculateTotalEstimate() * 0.3).toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <PageFooter pageNumber={3} />
              </div>