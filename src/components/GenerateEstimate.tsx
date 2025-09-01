import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import EstimatePDFGenerator from './EstimatePDFGenerator';
import { 
  FileText, 
  Download, 
  Search,
  Filter,
  Calendar,
  Building,
  IndianRupee,
  Eye,
  Printer
} from 'lucide-react';

const GenerateEstimate: React.FC = () => {
  const { user } = useAuth();
  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showPDFGenerator, setShowPDFGenerator] = useState(false);
  const [selectedWorkForPDF, setSelectedWorkForPDF] = useState<string>('');

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

  const handleGeneratePDF = (work: Work) => {
    setSelectedWorkForPDF(work.works_id);
    setShowPDFGenerator(true);
  };

  const getTypeBadge = (type: string) => {
    const typeConfig = {
      'Technical Sanction': { bg: 'bg-gradient-to-r from-blue-100 to-indigo-200', text: 'text-blue-800', label: 'TS' },
      'Administrative Approval': { bg: 'bg-gradient-to-r from-green-100 to-emerald-200', text: 'text-green-800', label: 'AA' },
    };

    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig['Technical Sanction'];

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text} shadow-lg`}>
        {config.label}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { bg: 'bg-gradient-to-r from-gray-100 to-slate-200', text: 'text-gray-800', label: 'Draft' },
      pending: { bg: 'bg-gradient-to-r from-amber-100 to-yellow-200', text: 'text-amber-800', label: 'Pending' },
      approved: { bg: 'bg-gradient-to-r from-green-100 to-emerald-200', text: 'text-green-800', label: 'Approved' },
      rejected: { bg: 'bg-gradient-to-r from-red-100 to-pink-200', text: 'text-red-800', label: 'Rejected' },
      in_progress: { bg: 'bg-gradient-to-r from-blue-100 to-indigo-200', text: 'text-blue-800', label: 'In Progress' },
      completed: { bg: 'bg-gradient-to-r from-purple-100 to-violet-200', text: 'text-purple-800', label: 'Completed' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${config.bg} ${config.text} shadow-lg`}>
        {config.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('hi-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);
  };

  const filteredWorks = works.filter(work => {
    const matchesSearch = work.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (work.works_id && work.works_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (work.division && work.division.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesType = typeFilter === 'all' || work.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || work.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return <LoadingSpinner text="Loading works..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02]">
        <div className="px-8 py-6">
          <div className="flex items-center">
            <div className="p-3 bg-white/20 rounded-2xl mr-4 shadow-lg">
              <FileText className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                Generate E-Estimate Reports
              </h1>
              <p className="text-violet-100 text-sm mt-1">Create professional PDF estimates for your construction projects</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-2xl shadow-lg border border-slate-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search works..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 text-sm border border-gray-300 rounded-xl leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 hover:bg-white transition-all duration-200 shadow-lg"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-2 max-w-xs">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="block pl-3 pr-8 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 rounded-xl bg-white/80 backdrop-blur-sm hover:bg-white transition-all duration-200 shadow-lg"
            >
              <option value="all">All Types</option>
              <option value="Technical Sanction">Technical Sanction (TS)</option>
              <option value="Administrative Approval">Administrative Approval (AA)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2 max-w-xs">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="block pl-3 pr-8 py-3 text-sm border border-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500 rounded-xl bg-white/80 backdrop-blur-sm hover:bg-white transition-all duration-200 shadow-lg"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Works List for PDF Generation */}
      <div className="bg-gradient-to-br from-white to-slate-50 shadow-xl rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-violet-500 to-purple-600">
          <div className="flex items-center">
            <div className="p-2 bg-white/20 rounded-lg mr-3">
              <Printer className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-white">Select Work to Generate PDF Report</h2>
          </div>
        </div>

        {filteredWorks.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredWorks.map((work) => (
              <div
                key={work.sr_no}
                className="p-6 hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-3">
                      <span className="text-sm font-bold text-gray-500">#{work.sr_no}</span>
                      {getTypeBadge(work.type)}
                      {getStatusBadge(work.status)}
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {work.works_id} - {work.work_name}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Building className="w-4 h-4 mr-2 text-blue-500" />
                        <span>Division: {work.division || 'N/A'}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <IndianRupee className="w-4 h-4 mr-2 text-green-500" />
                        <span>Cost: {formatCurrency(work.total_estimated_cost)}</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-4 h-4 mr-2 text-purple-500" />
                        <span>Created: {new Date(work.created_at).toLocaleDateString('hi-IN')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="ml-6">
                    <button
                      onClick={() => handleGeneratePDF(work)}
                      className="inline-flex items-center px-6 py-3 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-violet-300 transition-all duration-300"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Generate PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-violet-100 to-purple-200 rounded-3xl flex items-center justify-center mb-6 shadow-lg">
              <FileText className="h-12 w-12 text-violet-600" />
            </div>
            <h3 className="mt-2 text-lg font-bold text-gray-900">No works found</h3>
            <p className="mt-2 text-sm text-gray-500">
              No works match your current search and filter criteria.
            </p>
          </div>
        )}
      </div>

      {/* PDF Generator Modal */}
      {showPDFGenerator && (
        <EstimatePDFGenerator
          workId={selectedWorkForPDF}
          isOpen={showPDFGenerator}
          onClose={() => {
            setShowPDFGenerator(false);
            setSelectedWorkForPDF('');
          }}
        />
      )}
    </div>
  );
};

export default GenerateEstimate;