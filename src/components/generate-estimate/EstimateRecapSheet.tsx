import React from 'react';
import { CompleteEstimateData } from './EstimateSupabaseOperations';

interface TaxSetting {
  id: string;
  name: string;
  percentage: number;
  enabled: boolean;
}

interface EstimateRecapSheetProps {
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
  pageNumber: number;
  taxSettings: TaxSetting[];
}

export const EstimateRecapSheet: React.FC<EstimateRecapSheetProps> = ({
  estimateData,
  headerSettings,
  footerSettings,
  showPageNumbers,
  pageNumberPosition,
  pageNumber,
  taxSettings
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const calculateSubworkTotal = (subworkId: string) => {
    const items = estimateData.subworkItems[subworkId] || [];
    return items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
  };

  const calculateGrandTotal = () => {
    return estimateData.subworks.reduce((total, subwork) => {
      return total + calculateSubworkTotal(subwork.subworks_id);
    }, 0);
  };

  const calculateTaxAmount = (baseAmount: number, taxPercentage: number) => {
    return (baseAmount * taxPercentage) / 100;
  };

  const calculateFinalTotal = () => {
    const baseAmount = calculateGrandTotal();
    const enabledTaxes = taxSettings.filter(tax => tax.enabled);
    
    const totalTaxAmount = enabledTaxes.reduce((sum, tax) => {
      return sum + calculateTaxAmount(baseAmount, tax.percentage);
    }, 0);
    
    return baseAmount + totalTaxAmount;
  };

  return (
    <div className="page-break bg-white p-8 min-h-screen flex flex-col">
      {/* Header */}
      <div className="text-center mb-6 border-b border-gray-300 pb-4">
        <h1 className="text-xl font-bold text-red-600 mb-1">
          {headerSettings.line1}
        </h1>
        <h2 className="text-base font-semibold text-blue-600 mb-1">
          {headerSettings.line2}
        </h2>
        <h3 className="text-sm text-blue-500">
          {headerSettings.line3}
        </h3>
      </div>

      {/* Recap Title */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          ESTIMATE RECAP SHEET
        </h2>
        <h3 className="text-lg font-semibold text-gray-700">
          {estimateData.work.works_id} - {estimateData.work.work_name}
        </h3>
      </div>

      {/* Recap Table */}
      <div className="flex-1">
        <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                  Sr. No.
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                  Subwork ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                  Description of Subwork
                </th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase tracking-wider border-r border-gray-200">
                  No. of Items
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Amount (₹)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {estimateData.subworks.map((subwork, index) => {
                const itemCount = (estimateData.subworkItems[subwork.subworks_id] || []).length;
                const subworkTotal = calculateSubworkTotal(subwork.subworks_id);
                
                return (
                  <tr key={subwork.subworks_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-blue-600 border-r border-gray-200">
                      {subwork.subworks_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 border-r border-gray-200">
                      {subwork.subworks_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-gray-900 border-r border-gray-200">
                      {itemCount}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {formatCurrency(subworkTotal)}
                    </td>
                  </tr>
                );
              })}
              
              {/* Subtotal Row */}
              <tr className="bg-yellow-50 border-t-2 border-yellow-200">
                <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-900 text-right border-r border-gray-200">
                  Subtotal:
                </td>
                <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                  {formatCurrency(calculateGrandTotal())}
                </td>
              </tr>

              {/* Tax Rows */}
              {taxSettings.filter(tax => tax.enabled).map((tax) => {
                const taxAmount = calculateTaxAmount(calculateGrandTotal(), tax.percentage);
                return (
                  <tr key={tax.id} className="bg-blue-50">
                    <td colSpan={4} className="px-4 py-3 text-sm font-medium text-gray-900 text-right border-r border-gray-200">
                      {tax.name} ({tax.percentage}%):
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                      {formatCurrency(taxAmount)}
                    </td>
                  </tr>
                );
              })}

              {/* Grand Total Row */}
              <tr className="bg-green-100 border-t-2 border-green-300">
                <td colSpan={4} className="px-4 py-4 text-lg font-bold text-gray-900 text-right border-r border-gray-200">
                  GRAND TOTAL:
                </td>
                <td className="px-4 py-4 text-lg font-bold text-right text-green-700">
                  {formatCurrency(calculateFinalTotal())}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary Statistics */}
        <div className="mt-8 grid grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-blue-600">
              {estimateData.subworks.length}
            </div>
            <div className="text-xs text-blue-800">Total Subworks</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-green-600">
              {Object.values(estimateData.subworkItems).flat().length}
            </div>
            <div className="text-xs text-green-800">Total Items</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-purple-600">
              {taxSettings.filter(tax => tax.enabled).length}
            </div>
            <div className="text-xs text-purple-800">Applied Taxes</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
            <div className="text-xl font-bold text-orange-600">
              {((calculateFinalTotal() - calculateGrandTotal()) / calculateGrandTotal() * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-orange-800">Tax Rate</div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="mt-6 bg-gray-50 border border-gray-300 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-700 mb-2">
            Amount in Words:
          </div>
          <div className="text-sm text-gray-900 italic">
            {/* This would need a number-to-words conversion function */}
            Rupees {Math.floor(calculateFinalTotal()).toLocaleString('hi-IN')} and {Math.round((calculateFinalTotal() % 1) * 100)} Paise Only
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-6 border-t border-gray-300 pt-4">
        <p className="text-sm text-gray-600">{footerSettings.line1}</p>
        <p className="text-sm text-gray-600">{footerSettings.line2}</p>
        {showPageNumbers && pageNumberPosition === 'bottom' && (
          <p className="text-xs text-gray-500 mt-2">Page {pageNumber}</p>
        )}
      </div>
    </div>
  );
};