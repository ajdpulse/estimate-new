import React, { useEffect, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  Search, 
  FileText, 
  Calendar,
  Building,
  IndianRupee,
  Download,
  Edit2,
  Loader2
} from 'lucide-react';

interface MeasurementBookEntry {
  id: string;
  work_id: string;
  measurement_date: string;
  measured_quantity: number;
  approved_quantity: number;
  rate: number;
  amount: number;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  remarks?: string;
  created_at: string;
  updated_at: string;
}

const MeasurementBook: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [works, setWorks] = useState<Work[]>([]);
  const [selectedWork, setSelectedWork] = useState<Work | null>(null);
  const [measurements, setMeasurements] = useState<MeasurementBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mbStatus, setMbStatus] = useState<string>('approved');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    fetchApprovedWorks();
  }, []);

  useEffect(() => {
    if (selectedWork) {
      fetchMeasurements(selectedWork.works_id);
    }
  }, [selectedWork]);

  const fetchApprovedWorks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('status', 'approved')
        .order('sr_no', { ascending: false });

      if (error) throw error;
      setWorks(data || []);
      
      // Auto-select first work if available
      if (data && data.length > 0) {
        setSelectedWork(data[0]);
      }
    } catch (error) {
      console.error('Error fetching approved works:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeasurements = async (workId: string) => {
    try {
      // This would fetch from measurement_book table when implemented
      // For now, we'll use mock data
      const mockMeasurements: MeasurementBookEntry[] = [
        {
          id: '1',
          work_id: workId,
          measurement_date: '2025-01-15',
          measured_quantity: 100,
          approved_quantity: 95,
          rate: 500,
          amount: 47500,
          status: 'approved',
          remarks: 'Initial measurement',
          created_at: '2025-01-15T10:00:00Z',
          updated_at: '2025-01-15T10:00:00Z'
        }
      ];
      
      setMeasurements(mockMeasurements);
    } catch (error) {
      console.error('Error fetching measurements:', error);
    }
  };

  const handleStatusChange = async () => {
    if (!selectedWork) return;
    
    try {
      // Update the MB status in the database
      const { error } = await supabase
        .schema('estimate')
        .from('works')
        .update({ mb_status: mbStatus })
        .eq('works_id', selectedWork.works_id);

      if (error) throw error;
      
      // Update local state
      setSelectedWork(prev => prev ? { ...prev, mb_status: mbStatus } : null);
      
      alert('MB Status updated successfully!');
    } catch (error) {
      console.error('Error updating MB status:', error);
      alert('Failed to update MB status');
    }
  };

  const generateMBReport = async () => {
    if (!selectedWork) {
      alert('Please select a work to generate report');
      return;
    }

    try {
      setIsGeneratingReport(true);
      
      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert('MB Report generated successfully!');
    } catch (error) {
      console.error('Error generating MB report:', error);
      alert('Failed to generate MB report');
    } finally {
      setIsGeneratingReport(false);
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
      draft: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Draft' },
      submitted: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Submitted' },
      approved: { bg: 'bg-green-100', text: 'text-green-800', label: 'Approved' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const filteredWorks = works.filter(work => {
    const matchesSearch = work.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         work.works_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || work.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <LoadingSpinner text={t('common.loading')} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Measurement Book (MB)</h1>
          <p className="mt-1 text-sm text-gray-500">
            Record actual measurements for approved works and track variances
          </p>
        </div>
        
        {/* Controls - Only one set */}
        {selectedWork && (
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            {/* MB Status */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">MB Status:</label>
              <select
                value={mbStatus}
                onChange={(e) => setMbStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
              </select>
              <button
                onClick={handleStatusChange}
                className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Change Status
              </button>
            </div>

            {/* Generate MB Report */}
            <button
              onClick={generateMBReport}
              disabled={isGeneratingReport}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {isGeneratingReport ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Generate MB Report
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search approved works..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="approved">Approved</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Approved Works List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Approved Works</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {filteredWorks.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {filteredWorks.map((work) => (
                    <div
                      key={work.works_id}
                      onClick={() => setSelectedWork(work)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedWork?.works_id === work.works_id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {work.works_id}
                          </p>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                            {work.work_name}
                          </p>
                          <div className="flex items-center mt-2 text-xs text-gray-500">
                            <Building className="w-3 h-3 mr-1" />
                            <span>{work.division || 'N/A'}</span>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center text-xs text-gray-500">
                              <IndianRupee className="w-3 h-3 mr-1" />
                              <span>{formatCurrency(work.total_estimated_cost)}</span>
                            </div>
                            {getStatusBadge(work.status)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">No approved works found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Measurement Details */}
        <div className="lg:col-span-2">
          {selectedWork ? (
            <div className="space-y-6">
              {/* Selected Work Info */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selectedWork.works_id} - {selectedWork.work_name}
                    </h2>
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Division:</span> {selectedWork.division || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Sub Division:</span> {selectedWork.sub_division || 'N/A'}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Estimated Cost:</span> {formatCurrency(selectedWork.total_estimated_cost)}
                      </p>
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Approved Date:</span> {new Date(selectedWork.created_at).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    {getStatusBadge(selectedWork.status)}
                    {getStatusBadge('Pending')}
                  </div>
                </div>
              </div>

              {/* Measurement Details */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Measurement Details</h3>
                </div>
                <div className="p-6">
                  {measurements.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Measured Qty
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Approved Qty
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Rate
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Amount
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {measurements.map((measurement) => (
                            <tr key={measurement.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(measurement.measurement_date).toLocaleDateString('en-IN')}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {measurement.measured_quantity}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {measurement.approved_quantity}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(measurement.rate)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(measurement.amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(measurement.status)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="mx-auto h-12 w-12 text-gray-300" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">No measurements recorded</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Start recording measurements for this approved work.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Select a work to view measurements</h3>
              <p className="mt-1 text-sm text-gray-500">
                Choose an approved work from the list to view and manage its measurement book entries.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeasurementBook;