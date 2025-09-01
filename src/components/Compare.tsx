import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  BarChart3, 
  FileText,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Check,
  X,
  Calculator,
  BookOpen
} from 'lucide-react';

interface EstimateData {
  work: Work;
  subworks: SubWork[];
  subworkItems: { [subworkId: string]: SubworkItem[] };
  totalEstimateAmount: number;
}

interface MeasurementData {
  measurements: ItemMeasurement[];
  totalMeasurementAmount: number;
}

interface ComparisonResult {
  worksId: string;
  workName: string;
  estimateAmount: number;
  measurementAmount: number;
  difference: number;
  percentageVariance: number;
  status: 'over' | 'under' | 'equal';
}

const Compare: React.FC = () => {
  const { t } = useLanguage();
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWorksIds, setSelectedWorksIds] = useState<string[]>([]);
  const [comparisonResults, setComparisonResults] = useState<ComparisonResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    fetchWorks();
  }, []);

  const fetchWorks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .order('sr_no', { ascending: false });

      if (error) throw error;
      setWorks(data || []);
    } catch (error) {
      console.error('Error fetching works:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchEstimateData = async (worksId: string): Promise<EstimateData | null> => {
    try {
      // Fetch work details
      const { data: work, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', worksId)
        .single();

      if (workError || !work) return null;

      // Fetch subworks
      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', worksId);

      if (subworksError) return null;

      // Fetch subwork items for all subworks
      const subworkItems: { [subworkId: string]: SubworkItem[] } = {};
      let totalEstimateAmount = 0;

      for (const subwork of subworks || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id);

        subworkItems[subwork.subworks_id] = items || [];
        
        // Calculate total from subwork items
        const subworkTotal = (items || []).reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
        totalEstimateAmount += subworkTotal;
      }

      return {
        work,
        subworks: subworks || [],
        subworkItems,
        totalEstimateAmount
      };
    } catch (error) {
      console.error('Error fetching estimate data:', error);
      return null;
    }
  };

  const fetchMeasurementData = async (worksId: string): Promise<MeasurementData | null> => {
    try {
      // Fetch all measurements for this works ID
      const { data: measurements, error } = await supabase
        .schema('estimate')
        .from('item_measurements')
        .select(`
          *,
          subwork_items!inner(
            subwork_id,
            subworks!inner(
              works_id
            )
          )
        `)
        .eq('subwork_items.subworks.works_id', worksId);

      if (error) {
        console.error('Error fetching measurements:', error);
        return null;
      }

      const totalMeasurementAmount = (measurements || []).reduce(
        (sum, measurement) => sum + (measurement.line_amount || 0), 
        0
      );

      return {
        measurements: measurements || [],
        totalMeasurementAmount
      };
    } catch (error) {
      console.error('Error fetching measurement data:', error);
      return null;
    }
  };

  const performComparison = async () => {
    if (selectedWorksIds.length === 0) {
      alert('Please select at least one work to compare');
      return;
    }

    try {
      setComparing(true);
      const results: ComparisonResult[] = [];

      for (const worksId of selectedWorksIds) {
        const work = works.find(w => w.works_id === worksId);
        if (!work) continue;

        const [estimateData, measurementData] = await Promise.all([
          fetchEstimateData(worksId),
          fetchMeasurementData(worksId)
        ]);

        const estimateAmount = estimateData?.totalEstimateAmount || 0;
        const measurementAmount = measurementData?.totalMeasurementAmount || 0;
        const difference = measurementAmount - estimateAmount;
        const percentageVariance = estimateAmount > 0 ? (difference / estimateAmount) * 100 : 0;

        let status: 'over' | 'under' | 'equal' = 'equal';
        if (difference > 0) status = 'over';
        else if (difference < 0) status = 'under';

        results.push({
          worksId,
          workName: work.work_name,
          estimateAmount,
          measurementAmount,
          difference,
          percentageVariance,
          status
        });
      }

      setComparisonResults(results);
    } catch (error) {
      console.error('Error performing comparison:', error);
    } finally {
      setComparing(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const handleWorkSelection = (worksId: string) => {
    setSelectedWorksIds(prev => {
      if (prev.includes(worksId)) {
        return prev.filter(id => id !== worksId);
      } else if (prev.length < 3) { // Limit to 3 works for comparison
        return [...prev, worksId];
      }
      return prev;
    });
  };

  const getVarianceIcon = (status: 'over' | 'under' | 'equal') => {
    switch (status) {
      case 'over':
        return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'under':
        return <TrendingDown className="w-4 h-4 text-green-500" />;
      default:
        return <Check className="w-4 h-4 text-blue-500" />;
    }
  };

  const getVarianceColor = (status: 'over' | 'under' | 'equal') => {
    switch (status) {
      case 'over':
        return 'text-red-600';
      case 'under':
        return 'text-green-600';
      default:
        return 'text-blue-600';
    }
  };

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 via-red-600 to-pink-700 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <div className="px-8 py-6">
          <div className="flex items-center">
            <div className="p-3 bg-white/20 rounded-2xl mr-4 shadow-lg">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                Estimate vs Measurement Book Comparison
              </h1>
              <p className="text-orange-100 text-sm mt-1">Compare estimates with actual measurement book data by Works ID</p>
            </div>
          </div>
        </div>
      </div>

      {/* Work Selection */}
      <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-orange-500 to-red-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-lg mr-3">
                <Calculator className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">Select Works to Compare (Max 3)</h2>
            </div>
            <button
              onClick={performComparison}
              disabled={selectedWorksIds.length === 0 || comparing}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200 disabled:opacity-50 hover:scale-105"
            >
              {comparing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Comparing...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Compare Selected ({selectedWorksIds.length})
                </>
              )}
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {works.map((work) => (
              <div
                key={work.works_id}
                className={`relative border rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:scale-105 ${
                  selectedWorksIds.includes(work.works_id)
                    ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-red-50 shadow-lg'
                    : 'border-gray-200 hover:border-orange-300 hover:bg-gradient-to-br hover:from-orange-50 hover:to-red-50 hover:shadow-md'
                }`}
                onClick={() => handleWorkSelection(work.works_id)}
              >
                {selectedWorksIds.includes(work.works_id) && (
                  <div className="absolute top-2 right-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center shadow-lg">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {work.works_id}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {work.work_name}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(work.total_estimated_cost)}
                    </span>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      work.status === 'approved' ? 'bg-green-100 text-green-800' :
                      work.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {work.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonResults.length > 0 && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-lg mr-3">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-lg font-semibold text-white">Comparison Results</h2>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {comparisonResults.map((result, index) => {
              return (
                <div key={result.worksId} className="bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 hover:scale-105">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-base font-bold text-gray-900 truncate">
                      {result.worksId}
                    </h3>
                    <div className="flex items-center">
                      {getVarianceIcon(result.status)}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{result.workName}</p>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500">Estimate Amount</p>
                      <p className="text-lg font-bold text-blue-600">
                        {formatCurrency(result.estimateAmount)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-500">Measurement Book Total</p>
                      <p className="text-lg font-bold text-purple-600">
                        {formatCurrency(result.measurementAmount)}
                      </p>
                    </div>
                    
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">Variance</span>
                        <div className="flex items-center">
                          <span className={`text-sm font-bold ${getVarianceColor(result.status)}`}>
                            {result.percentageVariance > 0 ? '+' : ''}{result.percentageVariance.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <p className={`text-sm mt-1 font-medium ${getVarianceColor(result.status)}`}>
                        {formatCurrency(Math.abs(result.difference))} 
                        {result.status === 'over' ? ' over estimate' : 
                         result.status === 'under' ? ' under estimate' : ' exact match'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Comparison Table */}
          <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-500 to-blue-600">
              <h3 className="text-lg font-semibold text-white">Detailed Comparison Report</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-slate-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Works ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Work Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Estimate Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Measurement Book Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Difference
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Variance %
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comparisonResults.map((result) => {
                    return (
                      <tr key={result.worksId} className="hover:bg-gradient-to-r hover:from-orange-50 hover:to-red-50 transition-all duration-200">
                        <td className="px-6 py-4">
                          <div className="text-sm font-bold text-gray-900">{result.worksId}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">{result.workName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">
                          {formatCurrency(result.estimateAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-600">
                          {formatCurrency(result.measurementAmount)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${getVarianceColor(result.status)}`}>
                          {result.difference > 0 ? '+' : ''}{formatCurrency(result.difference)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {getVarianceIcon(result.status)}
                            <span className={`ml-2 text-sm font-bold ${getVarianceColor(result.status)}`}>
                              {result.percentageVariance > 0 ? '+' : ''}{result.percentageVariance.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {selectedWorksIds.length === 0 && comparisonResults.length === 0 && (
        <div className="text-center py-16 bg-gradient-to-br from-white to-slate-50 rounded-2xl shadow-lg border border-slate-200">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-100 to-red-200 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
            <BarChart3 className="h-10 w-10 text-orange-600" />
          </div>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No works selected for comparison</h3>
          <p className="mt-1 text-sm text-gray-500">
            Select works above to compare estimates with measurement book data.
          </p>
        </div>
      )}
    </div>
  );
};

export default Compare;