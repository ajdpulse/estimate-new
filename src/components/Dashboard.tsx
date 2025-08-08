import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { EstimateWork } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  BarChart3, 
  FileText, 
  Clock, 
  IndianRupee, 
  TrendingUp,
  Activity
} from 'lucide-react';

interface DashboardStats {
  totalWorks: number;
  pendingApprovals: number;
  totalAmount: number;
  recentWorks: EstimateWork[];
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch works statistics
      const { data: works } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .order('sr_no', { ascending: false });

      if (works) {
        const totalWorks = works.length;
        const pendingApprovals = works.filter(work => work.status === 'pending').length;
        const totalAmount = works.reduce((sum, work) => sum + work.estimated_amount, 0);
        const recentWorks = works.slice(0, 5);

        setStats({
          totalWorks,
          pendingApprovals,
          totalAmount,
          recentWorks,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center">
            <div>
              <h1 className="text-lg font-bold text-white">
                {t('dashboard.welcome')}, {user?.user_metadata?.full_name || user?.email}
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {t('dashboard.totalWorks')}
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.totalWorks || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Clock className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {t('dashboard.pendingApprovals')}
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.pendingApprovals || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <IndianRupee className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                {t('dashboard.totalAmount')}
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(stats?.totalAmount || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">
                Technical Sanction
              </p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.recentWorks.filter(w => w.type === 'Technical Sanction').length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center">
            <Activity className="h-5 w-5 text-gray-400 mr-2" />
            <h2 className="text-lg font-medium text-gray-900">
              {t('dashboard.recentActivity')}
            </h2>
          </div>
        </div>
        <div className="p-6">
          {stats?.recentWorks && stats.recentWorks.length > 0 ? (
            <div className="space-y-4">
              {stats.recentWorks.map((work) => (
                <div key={work.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">
                      {work.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {work.description}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(work.created_at).toLocaleDateString('hi-IN')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(work.estimated_amount)}
                    </span>
                    {getStatusBadge(work.status)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-2 text-sm text-gray-500">
                No recent activity found
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <FileText className="h-8 w-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">{t('works.addNew')}</span>
          </button>
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <BarChart3 className="h-8 w-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">View Reports</span>
          </button>
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <TrendingUp className="h-8 w-8 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">Analytics</span>
          </button>
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <Clock className="h-8 w-8 text-orange-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">Pending Reviews</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;