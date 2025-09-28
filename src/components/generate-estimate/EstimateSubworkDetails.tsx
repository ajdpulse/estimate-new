import React from 'react';
import { CompleteEstimateData } from './EstimateSupabaseOperations';

interface EstimateSubworkDetailsProps {
  estimateData: CompleteEstimateData;
  headerSettings: {
    line1: string;
    line2: string;
    line3: string;
  };
  footerSettings: {
    line1: string;
    line2: string;
  };
  showPageNumbers: boolean;
  pageNumberPosition: string;
  startingPageNumber: number;
}

export const EstimateSubworkDetails: React.FC<EstimateSubworkDetailsProps> = ({
  estimateData,
  headerSettings,
  footerSettings,
  showPageNumbers,
  pageNumberPosition,
  startingPageNumber
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString('hi-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  };

  let currentPageNumber = startingPageNumber;

  return (
    <div className="subwork-details">
      {estimateData.subworks.map((subwork, subworkIndex) => {
        const items = estimateData.subworkItems[subwork.subworks_id] || [];
        const subworkTotal = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
        
        return (
          <div key={subwork.subworks_id} className="page-break bg-white p-8 min-h-screen flex flex-col">
            {/* Header */}
            <div className="text-center mb-4 border-b border-gray-300 pb-3">
              <h1 className="text-lg font-bold text-red-600 mb-1">
                {headerSettings.line1}
              </h1>
              <h2 className="text-base font-semibold text-blue-600 mb-1">
                {headerSettings.line2}
              </h2>
              <h3 className="text-sm text-blue-500">
                {headerSettings.line3}
              </h3>
            </div>

            {/* Subwork Title */}
            <div className="mb-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-100 border border-blue-200 rounded-lg p-4">
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  SUBWORK {subworkIndex + 1}: {subwork.subworks_id}
                </h2>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  {subwork.subworks_name}
                </h3>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">
                    Total Items: {items.length}
                  </span>
                  <span className="font-bold text-green-600">
                    Subwork Total: {formatCurrency(subworkTotal)}
                  </span>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="flex-1">
              {items.length > 0 ? (
                <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-2 text-left font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-12">
                          Sr.
                        </th>
                        <th className="px-2 py-2 text-left font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-16">
                          Item No.
                        </th>
                        <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                          Description of Item
                        </th>
                        <th className="px-2 py-2 text-center font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-16">
                          Qty
                        </th>
                        <th className="px-2 py-2 text-center font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-12">
                          Unit
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200 w-20">
                          Rate (₹)
                        </th>
                        <th className="px-2 py-2 text-right font-bold text-gray-700 uppercase tracking-wider w-24">
                          Amount (₹)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {items.map((item, itemIndex) => {
                        const measurements = estimateData.measurements[item.id] || [];
                        const leads = estimateData.leads[item.id] || [];
                        const materials = estimateData.materials[item.id] || [];
                        
                        return (
                          <React.Fragment key={item.id}>
                            {/* Main Item Row */}
                            <tr className="hover:bg-gray-50">
                              <td className="px-2 py-2 text-center font-medium text-gray-900 border-r border-gray-200">
                                {itemIndex + 1}
                              </td>
                              <td className="px-2 py-2 font-medium text-blue-600 border-r border-gray-200">
                                {item.item_number}
                              </td>
                              <td className="px-3 py-2 text-gray-900 border-r border-gray-200">
                                <div className="font-medium">{item.description_of_item}</div>
                                {item.category && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Category: {item.category}
                                  </div>
                                )}
                              </td>
                              <td className="px-2 py-2 text-center text-gray-900 border-r border-gray-200">
                                {formatNumber(item.ssr_quantity)}
                              </td>
                              <td className="px-2 py-2 text-center text-gray-900 border-r border-gray-200">
                                {item.ssr_unit}
                              </td>
                              <td className="px-2 py-2 text-right text-gray-900 border-r border-gray-200">
                                {formatNumber(item.ssr_rate)}
                              </td>
                              <td className="px-2 py-2 text-right font-medium text-gray-900">
                                {formatCurrency(item.total_item_amount)}
                              </td>
                            </tr>

                            {/* Measurements Details */}
                            {measurements.length > 0 && (
                              <tr>
                                <td colSpan={7} className="px-3 py-2 bg-green-50 border-t border-green-200">
                                  <div className="text-xs">
                                    <div className="font-semibold text-green-800 mb-2">Measurements:</div>
                                    <div className="grid grid-cols-1 gap-1">
                                      {measurements.map((measurement, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                          <span className="text-green-700">
                                            {measurement.description_of_items || 'Measurement'} - 
                                            Units: {measurement.no_of_units}, 
                                            L: {measurement.length}, 
                                            W: {measurement.width_breadth}, 
                                            H: {measurement.height_depth}
                                          </span>
                                          <span className="font-medium text-green-800">
                                            Qty: {formatNumber(measurement.calculated_quantity)} {measurement.unit}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* Leads Details */}
                            {leads.length > 0 && (
                              <tr>
                                <td colSpan={7} className="px-3 py-2 bg-blue-50 border-t border-blue-200">
                                  <div className="text-xs">
                                    <div className="font-semibold text-blue-800 mb-2">Lead Charges:</div>
                                    <div className="grid grid-cols-1 gap-1">
                                      {leads.map((lead, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                          <span className="text-blue-700">
                                            {lead.material} - {lead.location_of_quarry} ({lead.lead_in_km} km)
                                          </span>
                                          <span className="font-medium text-blue-800">
                                            ₹{formatNumber(lead.net_lead_charges)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}

                            {/* Materials Details */}
                            {materials.length > 0 && (
                              <tr>
                                <td colSpan={7} className="px-3 py-2 bg-purple-50 border-t border-purple-200">
                                  <div className="text-xs">
                                    <div className="font-semibold text-purple-800 mb-2">Materials:</div>
                                    <div className="grid grid-cols-1 gap-1">
                                      {materials.map((material, idx) => (
                                        <div key={idx} className="flex justify-between items-center">
                                          <span className="text-purple-700">
                                            {material.material_name} - {formatNumber(material.required_quantity)} {material.unit} @ ₹{formatNumber(material.rate_per_unit)}
                                          </span>
                                          <span className="font-medium text-purple-800">
                                            {formatCurrency(material.total_material_cost)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      
                      {/* Subwork Total Row */}
                      <tr className="bg-yellow-50 border-t-2 border-yellow-200">
                        <td colSpan={6} className="px-3 py-3 text-sm font-bold text-gray-900 text-right border-r border-gray-200">
                          Subwork Total:
                        </td>
                        <td className="px-2 py-3 text-sm font-bold text-right text-gray-900">
                          {formatCurrency(subworkTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No items found for this subwork
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center mt-4 border-t border-gray-300 pt-3">
              <p className="text-xs text-gray-600">{footerSettings.line1}</p>
              <p className="text-xs text-gray-600">{footerSettings.line2}</p>
              {showPageNumbers && pageNumberPosition === 'bottom' && (
                <p className="text-xs text-gray-500 mt-2">Page {currentPageNumber++}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};