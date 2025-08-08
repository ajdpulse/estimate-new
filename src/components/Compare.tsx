import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { EstimateWork, EstimateSubWork } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  BarChart3, 
  FileText,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Check,
  X
} from 'lucide-react';

interface ComparisonData {
  work: EstimateWork;
  subworks: EstimateSubWork[];
  totalSubworkAmount: number;
}

const Compare: React.FC = () => {
  const { t } = useLanguage();
  const [works, setWorks] = useState<EstimateWork[]>([]);
  const [selectedWorks, setSelectedWorks] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorks();
  }, []);

  useEffect(() => {
    if (selectedWorks.length > 0) {
      fetchComparisonData();
    }
  }, [selectedWorks]);

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

  const fetchComparisonData = async () => {
    try {
      const data: ComparisonData[] = [];

      for (const workId of selectedWorks) {
        const work = works.find(w => w.id === workId);
        if (!work) continue;

        const { data: subworks } = await supabase
          .from('estimate_subworks')
          .select('*')
          .eq('work_id', workId);

        const totalSubworkAmount = (subworks || []).reduce(
          (sum, subwork) => sum + subwork.total_amount, 
          0
        );

        data.push({
          work,
          subworks: subworks || [],
          totalSubworkAmount,
        });
      }

      setComparisonData(data);
    } catch (error) {
      console.error('Error fetching comparison data:', error);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: t('status.draft') },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: t('status.pending') },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: t('status.approved') },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: t('status.rejected') },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const handleWorkSelection = (workId: string) => {
    setSelectedWorks(prev => {
      if (prev.includes(workId)) {
        return prev.filter(id => id !== workId);
      } else if (prev.length < 3) { // Limit to 3 works for comparison
        return [...prev, workId];
      }
      return prev;
    });
  };

  const getVarianceInfo = (estimated: number, actual: number) => {
    const difference = actual - estimated;
    const percentageVariance = estimated > 0 ? (difference / estimated) * 100 : 0;
    
    return {
      difference,
      percentage: percentageVariance,
      isOver: difference > 0,
      isWithinTolerance: Math.abs(percentageVariance) <= 5, // 5% tolerance
    };
  };

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('compare.title')}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compare multiple works and analyze their estimates vs actual sub-work costs
        </p>
      </div>

      {/* Work Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          {t('compare.selectWorks')} (Max 3)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {works.map((work) => (
            <div
              key={work.id}
              className={`relative border rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                selectedWorks.includes(work.id)
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => handleWorkSelection(work.id)}
            >
              {selectedWorks.includes(work.id) && (
                <div className="absolute top-2 right-2">
                  <Check className="w-5 h-5 text-blue-600" />
                </div>
              )}
              <div>
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {work.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                  {work.description}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(work.estimated_amount)}
                  </span>
                  {getStatusBadge(work.status)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonData.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-medium text-gray-900">
            {t('compare.comparison')}
          </h2>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {comparisonData.map((data, index) => {
              const variance = getVarianceInfo(data.work.estimated_amount, data.totalSubworkAmount);
              
              return (
                <div key={data.work.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {data.work.title}
                    </h3>
                    {getStatusBadge(data.work.status)}
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-gray-500">Original Estimate</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {formatCurrency(data.work.estimated_amount)}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-500">Sub Works Total</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {formatCurrency(data.totalSubworkAmount)}
                      </p>
                    </div>
                    
                    <div className="border-t pt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Variance</span>
                        <div className="flex items-center">
                          {variance.isOver ? (
                            <TrendingUp className="w-4 h-4 text-red-500 mr-1" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-green-500 mr-1" />
                          )}
                          <span className={`text-sm font-medium ${
                            variance.isOver ? 'text-red-600' : 'text-green-600'
                          }`}>
                            {variance.percentage > 0 ? '+' : ''}{variance.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      <p className={`text-sm mt-1 ${
                        variance.isOver ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(Math.abs(variance.difference))} 
                        {variance.isOver ? ' over' : ' under'} estimate
                      </p>
                      
                      <div className="flex items-center mt-2">
                        {variance.isWithinTolerance ? (
                          <Check className="w-4 h-4 text-green-500 mr-1" />
                        ) : (
                          <X className="w-4 h-4 text-red-500 mr-1" />
                        )}
                        <span className={`text-xs ${
                          variance.isWithinTolerance ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {variance.isWithinTolerance ? 'Within tolerance' : 'Outside tolerance'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-500">
                      {data.subworks.length} sub work{data.subworks.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Detailed Comparison Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Detailed Comparison</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Work
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original Estimate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sub Works Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Sub Works Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {comparisonData.map((data) => {
                    const variance = getVarianceInfo(data.work.estimated_amount, data.totalSubworkAmount);
                    
                    return (
                      <tr key={data.work.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {data.work.title}
                            </div>
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {data.work.description}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(data.work.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(data.work.estimated_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {formatCurrency(data.totalSubworkAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {variance.isOver ? (
                              <TrendingUp className="w-4 h-4 text-red-500 mr-2" />
                            ) : (
                              <TrendingDown className="w-4 h-4 text-green-500 mr-2" />
                            )}
                            <div>
                              <div className={`text-sm font-medium ${
                                variance.isOver ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {variance.percentage > 0 ? '+' : ''}{variance.percentage.toFixed(1)}%
                              </div>
                              <div className={`text-xs ${
                                variance.isOver ? 'text-red-500' : 'text-green-500'
                              }`}>
                                {formatCurrency(Math.abs(variance.difference))}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {data.subworks.length}
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
      {selectedWorks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No works selected for comparison</h3>
          <p className="mt-1 text-sm text-gray-500">
            Select 2-3 works above to see a detailed comparison analysis.
          </p>
        </div>
      )}
    </div>
  );
};

export default Compare;