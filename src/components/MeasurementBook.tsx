import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import {
  BookOpen,
  Search,
  Filter,
  Calculator,
  FileText,
  IndianRupee,
  Building,
  Plus,
  Ruler,
  CheckCircle,
  AlertCircle,
  Clock,
  X
} from 'lucide-react';

interface ItemRate {
    sr_no: number;
    subwork_item_sr_no: number;
    description: string;
    rate: number;
    ssr_unit: string | null;
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    document_reference?: string;
    ssr_quantity?: number | null;
    rate_total_amount?: number | null;
    calculated_quantity?: number;
    is_deduction?: boolean;
    is_manual_quantity?: boolean;
    id?: number;
    length?: number;
    width?: number;
    height?: number;
    subwork_items?: { subwork_id: string };
    subwork_id?: string;
}

interface MeasurementForm {
    description_of_items: string;
    no_of_units: number;
    length: number;
    width_breadth: number;
    height_depth: number;
    actual_quantity: number;
    variance_reason: string;
    unit: string;
}

const MeasurementBook = () => {
    const { user } = useAuth();
    const { t } = useLanguage();

    const [works, setWorks] = useState<Work[]>([]);
    const [selectedWorkId, setSelectedWorkId] = useState<string>('');
    const [subworks, setSubworks] = useState<SubWork[]>([]);
    const [selectedSubworkId, setSelectedSubworkId] = useState<string>('all');
    const [itemRates, setItemRates] = useState<ItemRate[]>([]);
    const [measurementData, setMeasurementData] = useState<ItemRate[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [editingRow, setEditingRow] = useState<number | null>(null);
    const [formData, setFormData] = useState<MeasurementForm>({
        description_of_items: '',
        no_of_units: 1,
        length: 0,
        width_breadth: 0,
        height_depth: 0,
        actual_quantity: 0,
        variance_reason: '',
        unit: ''
    });
    const [showModal, setShowModal] = useState(false);
    const [viewMode, setViewMode] = useState<'itemRates' | 'measurementData'>('itemRates');
    const [expandedSubworks, setExpandedSubworks] = useState<Set<string>>(new Set());

    const filteredItemRates =
        selectedSubworkId === 'all'
            ? itemRates
            : itemRates.filter(
                ir => String(ir.subwork_items?.subwork_id) === String(selectedSubworkId)
            );

    const filteredMeasurementData =
        selectedSubworkId === 'all'
            ? measurementData
            : measurementData.filter(
                mb => String(mb.subwork_id) === String(selectedSubworkId)
            );

    useEffect(() => {
        fetchWorks();
    }, []);

    useEffect(() => {
        if (selectedWorkId) {
            fetchSubworks(selectedWorkId);
            fetchItemRates(selectedWorkId, selectedSubworkId);
            fetchMeasurementData(selectedWorkId, selectedSubworkId);
        } else {
            setSubworks([]);
            setItemRates([]);
            setMeasurementData([]);
        }
    }, [selectedWorkId, selectedSubworkId]);

    const fetchWorks = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .schema('estimate')
                .from('works')
                .select('*')
                .in('status', ['approved', 'in_progress', 'completed', 'draft'])
                .order('sr_no', { ascending: false });
            if (error) throw error;
            setWorks(data || []);
            if ((data?.length || 0) > 0 && !selectedWorkId)
                setSelectedWorkId(data[0].works_id);
        } catch (error) {
            console.error('Error fetching works:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSubworks = async (workId: string) => {
        try {
            const { data, error } = await supabase
                .schema('estimate')
                .from('subworks')
                .select('*')
                .eq('works_id', workId)
                .order('sr_no');
            if (error) throw error;
            setSubworks(data || []);
        } catch (error) {
            console.error('Error fetching subworks:', error);
        }
    };

    const fetchItemRates = async (workId: string, subworkId: string) => {
        try {
            setLoading(true);

            const { data: subworksData, error: subworksError } = await supabase
                .schema('estimate')
                .from('subworks')
                .select('sr_no, subworks_id')
                .eq('works_id', workId);
            if (subworksError) throw subworksError;

            const subworkIdsToUse: string[] =
                subworkId && subworkId !== 'all'
                    ? [subworkId]
                    : subworksData?.map(sw => sw.subworks_id) || [];
            if (subworkIdsToUse.length === 0) {
                setItemRates([]);
                setLoading(false);
                return;
            }

            const { data: subworkItemsData, error: subworkItemsError } = await supabase
                .schema('estimate')
                .from('subwork_items')
                .select('sr_no, subwork_id')
                .in('subwork_id', subworkIdsToUse);
            if (subworkItemsError) throw subworkItemsError;

            const subworkItemSrNos = subworkItemsData?.map(item => item.sr_no) || [];
            if (subworkItemSrNos.length === 0) {
                setItemRates([]);
                setLoading(false);
                return;
            }

            const { data: itemRatesData, error: itemRatesError } = await supabase
                .schema('estimate')
                .from('item_rates')
                .select(`
                    sr_no,
                    description,
                    rate_total_amount,
                    ssr_unit,
                    subwork_items(subwork_id)
                `)
                .in('subwork_item_sr_no', subworkItemSrNos)
                .order('sr_no', { ascending: true });
            if (itemRatesError) throw itemRatesError;

            const { data: measurementsData, error: measurementsError } = await supabase
                .schema('estimate')
                .from('item_measurements')
                .select('*')
                .in('subwork_item_id', subworkItemSrNos);
            if (measurementsError) throw measurementsError;

            const mergedData = itemRatesData?.map(rate => {
                const measurement = measurementsData?.find(m => m.rate_sr_no === rate.sr_no);
                return {
                    sr_no: rate.sr_no,
                    subwork_item_sr_no: measurement?.subwork_item_id || rate.sr_no,
                    description: rate.description || measurement?.description_of_items || '-',
                    ssr_unit: rate.ssr_unit || measurement?.unit || '',
                    calculated_quantity: measurement?.calculated_quantity || 0,
                    length: measurement?.length || 0,
                    width: measurement?.width_breadth || 0,
                    height: measurement?.height_depth || 0,
                    is_deduction: measurement?.is_deduction || false,
                    is_manual_quantity: measurement?.is_manual_quantity || false,
                    rate_total_amount: rate.rate_total_amount || 0,
                    id: rate.sr_no,
                    subwork_items: rate.subwork_items || null,
                };
            }) || [];

            setItemRates(mergedData);
        } catch (error) {
            console.error("Error in fetchItemRates:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMeasurementData = async (workId: string, subworkId: string) => {
        try {
            let query = supabase
                .schema('estimate')
                .from('measurement_book')
                .select('*')
                .eq('work_id', workId);

            if (subworkId && subworkId !== 'all') {
                query = query.eq('subwork_id', subworkId);
            }

            const { data, error } = await query;
            if (error) throw error;

            setMeasurementData(data || []);
        } catch (error) {
            console.error("Error in fetchMeasurementData:", error);
        }
    };

    const handleAddMeasurementClick = (measurement: ItemRate) => {
        setEditingRow(measurement.sr_no);
        setFormData({
            description_of_items: measurement.description || '',
            no_of_units: 1,
            length: measurement.length || 0,
            width_breadth: measurement.width || 0,
            height_depth: measurement.height || 0,
            actual_quantity: measurement.calculated_quantity || 0,
            variance_reason: '',
            unit: measurement.ssr_unit || ''
        });
        setShowModal(true);
    };

    const handleFormChange = (field: keyof MeasurementForm, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleFormSubmit = async () => {
        if (!selectedWorkId || !selectedSubworkId || selectedSubworkId === 'all') {
            alert("Please select a specific Subwork before adding measurement");
            return;
        }
        try {
            const { error } = await supabase
                .schema('estimate')
                .from('measurement_book')
                .insert([{
                    work_id: selectedWorkId,
                    subwork_id: selectedSubworkId,
                    item_id: editingRow?.toString() || '',
                    measurement_sr_no: 1,
                    description_of_items: formData.description_of_items,
                    no_of_units: formData.no_of_units,
                    length: formData.length,
                    width_breadth: formData.width_breadth,
                    height_depth: formData.height_depth,
                    estimated_quantity: formData.length * formData.width_breadth * formData.height_depth * formData.no_of_units,
                    actual_quantity: formData.actual_quantity,
                    estimated_amount: formData.length * formData.width_breadth * formData.height_depth * formData.no_of_units,
                    variance_reason: formData.variance_reason,
                    unit: formData.unit,
                    measured_by: user?.email || ''
                }]);

            if (error) throw error;
            setShowModal(false);
            setEditingRow(null);
            fetchMeasurementData(selectedWorkId, selectedSubworkId);
        } catch (error) {
            console.error("Error inserting measurement_book:", error);
            alert("Failed to add measurement");
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
            draft: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft', icon: FileText },
            pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending', icon: Clock },
            approved: { bg: 'bg-green-100', text: 'text-green-700', label: 'Approved', icon: CheckCircle },
            rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejected', icon: AlertCircle },
            in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'In Progress', icon: Calculator },
            completed: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Completed', icon: CheckCircle },
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
        const IconComponent = config.icon;

        return (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
                <IconComponent className="w-3 h-3 mr-1" />
                {config.label}
            </span>
        );
    };

    const toggleSubwork = (subworkId: string) => {
        setExpandedSubworks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(subworkId)) {
                newSet.delete(subworkId);
            } else {
                newSet.add(subworkId);
            }
            return newSet;
        });
    };

    const filteredWorks = works.filter(work => {
        const matchesSearch = work.work_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (work.works_id && work.works_id.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesStatus = statusFilter === 'all' || work.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const selectedWork = works.find(w => w.works_id === selectedWorkId);

    if (loading && !selectedWorkId) {
        return <LoadingSpinner text="Loading measurement book..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Enhanced Header */}
            <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 shadow-xl">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                            <BookOpen className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white drop-shadow-lg">
                                Measurement Book (MB)
                            </h1>
                            <p className="text-emerald-100 text-base mt-1 drop-shadow">
                                Record and manage detailed measurements for construction works
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Controls Section */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                    {/* Work Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Building className="w-4 h-4 inline mr-1" />
                            Select Work
                        </label>
                        <select
                            value={selectedWorkId}
                            onChange={(e) => {
                                const newWorkId = e.target.value;
                                setSelectedWorkId(newWorkId);
                                setSelectedSubworkId('all');
                                if (newWorkId) {
                                    fetchItemRates(newWorkId, 'all');
                                    fetchMeasurementData(newWorkId, 'all');
                                }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                            <option value="">Select Work...</option>
                            {works.map((work) => (
                                <option key={work.works_id} value={work.works_id}>
                                    {work.works_id} - {work.work_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Search className="w-4 h-4 inline mr-1" />
                            Search Works
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search works..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Filter className="w-4 h-4 inline mr-1" />
                            Status Filter
                        </label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                            <option value="all">All Status</option>
                            <option value="draft">Draft</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>

                    {/* View Mode Toggle */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">View Mode</label>
                        <select
                            value={viewMode}
                            onChange={e => setViewMode(e.target.value as 'itemRates' | 'measurementData')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                            <option value="itemRates">Item Rates</option>
                            <option value="measurementData">Measurement Data</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Selected Work Info */}
            {selectedWork && (
                <div className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <FileText className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">
                                    {selectedWork.works_id} - {selectedWork.work_name}
                                </h3>
                                <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                                    <span className="flex items-center">
                                        <Building className="w-4 h-4 mr-1" />
                                        {selectedWork.division || 'N/A'}
                                    </span>
                                    <span className="flex items-center">
                                        <IndianRupee className="w-4 h-4 mr-1" />
                                        Estimate: {formatCurrency(selectedWork.total_estimated_cost)}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div>
                            {getStatusBadge(selectedWork.status)}
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="px-6 py-6">
                {selectedWorkId && viewMode === 'itemRates' ? (
                    <div className="space-y-6">
                        {subworks.map((subwork) => {
                            const isExpanded = expandedSubworks.has(subwork.subworks_id);
                            const subworkItems = filteredItemRates.filter(
                                ir => String(ir.subwork_items?.subwork_id) === String(subwork.subworks_id)
                            );

                            return (
                                <div key={subwork.subworks_id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                                    <div
                                        className="px-6 py-4 border-b border-gray-200 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                                        onClick={() => toggleSubwork(subwork.subworks_id)}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="font-semibold text-gray-900">
                                                    {subwork.subworks_id} - {subwork.subworks_name}
                                                </h3>
                                                <p className="text-sm text-gray-600 mt-1">{subworkItems.length} items</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-sm text-gray-500">
                                                    {isExpanded ? 'Click to collapse' : 'Click to expand'}
                                                </span>
                                                <svg
                                                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && subworkItems.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gradient-to-r from-emerald-50 to-teal-50">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Sr No</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Description</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Units</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Length</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Width</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Height</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Quantity</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                                                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {subworkItems.map((ir, index) => (
                                                        <tr key={ir.sr_no} className="hover:bg-gray-50">
                                                            <td className="px-3 py-2 text-sm text-gray-900">{index + 1}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-900">{ir.description || '-'}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-900">{ir.ssr_unit || '-'}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-900">{ir.length?.toFixed(3) || 0}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-900">{ir.width?.toFixed(3) || 0}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-900">{ir.height?.toFixed(3) || 0}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-900">{ir.calculated_quantity || 0}</td>
                                                            <td className="px-3 py-2 text-sm text-gray-900">{formatCurrency(ir.rate_total_amount || 0)}</td>
                                                            <td className="px-3 py-2">
                                                                <button
                                                                    onClick={() => handleAddMeasurementClick(ir)}
                                                                    className="inline-flex items-center px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                                                                >
                                                                    <Plus className="w-4 h-4 mr-1" />
                                                                    Add
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : isExpanded && subworkItems.length === 0 ? (
                                        <div className="px-6 py-8 text-center text-gray-500">
                                            <Calculator className="mx-auto h-8 w-8 mb-2" />
                                            <p>No items found in this subwork</p>
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                ) : selectedWorkId && viewMode === 'measurementData' ? (
                    <div className="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200">
                        {filteredMeasurementData.length > 0 ? (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gradient-to-r from-blue-600 to-cyan-600">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Sr No</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Description</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Units</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Length</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Width</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Height</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Quantity</th>
                                        <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredMeasurementData.map((mb, index) => (
                                        <tr key={mb.sr_no} className="hover:bg-gray-50">
                                            <td className="px-3 py-2 text-sm text-gray-900">{index + 1}</td>
                                            <td className="px-3 py-2 text-sm text-gray-900">{mb.description_of_items || '-'}</td>
                                            <td className="px-3 py-2 text-sm text-gray-900">{mb.unit || '-'}</td>
                                            <td className="px-3 py-2 text-sm text-gray-900">{mb.length || 0}</td>
                                            <td className="px-3 py-2 text-sm text-gray-900">{mb.width_breadth || 0}</td>
                                            <td className="px-3 py-2 text-sm text-gray-900">{mb.height_depth || 0}</td>
                                            <td className="px-3 py-2 text-sm text-gray-900">{mb.actual_quantity || 0}</td>
                                            <td className="px-3 py-2 text-sm text-gray-900">{formatCurrency(mb.estimated_amount || 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-12">
                                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-2xl flex items-center justify-center mb-4">
                                    <Calculator className="h-10 w-10 text-emerald-600" />
                                </div>
                                <h3 className="mt-2 text-sm font-medium text-gray-900">
                                    No Measurement Data Found
                                </h3>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                        <BookOpen className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Select a work to begin</h3>
                        <p className="text-gray-500">Choose a work from the dropdown above to start recording measurements.</p>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-3xl relative shadow-lg max-h-[90vh] overflow-y-auto">
                        <button
                            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
                            onClick={() => setShowModal(false)}
                        >
                            <X className="w-6 h-6" />
                        </button>
                        <h2 className="text-xl font-semibold mb-4">Add Measurement</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                <input
                                    type="text"
                                    placeholder="Description"
                                    value={formData.description_of_items}
                                    onChange={e => handleFormChange('description_of_items', e.target.value)}
                                    className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Units</label>
                                <input
                                    type="number"
                                    placeholder="Units"
                                    value={formData.no_of_units}
                                    onChange={e => handleFormChange('no_of_units', Number(e.target.value))}
                                    className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
                                <input
                                    type="number"
                                    placeholder="Length"
                                    value={formData.length}
                                    onChange={e => handleFormChange('length', Number(e.target.value))}
                                    className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Width</label>
                                <input
                                    type="number"
                                    placeholder="Width"
                                    value={formData.width_breadth}
                                    onChange={e => handleFormChange('width_breadth', Number(e.target.value))}
                                    className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
                                <input
                                    type="number"
                                    placeholder="Height"
                                    value={formData.height_depth}
                                    onChange={e => handleFormChange('height_depth', Number(e.target.value))}
                                    className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                <input
                                    type="number"
                                    placeholder="Quantity"
                                    value={formData.actual_quantity}
                                    onChange={e => handleFormChange('actual_quantity', Number(e.target.value))}
                                    className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Variance Reason</label>
                                <input
                                    type="text"
                                    placeholder="Variance Reason"
                                    value={formData.variance_reason}
                                    onChange={e => handleFormChange('variance_reason', e.target.value)}
                                    className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                                <input
                                    type="text"
                                    placeholder="Unit"
                                    value={formData.unit}
                                    onChange={e => handleFormChange('unit', e.target.value)}
                                    className="px-4 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 w-full"
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end space-x-3">
                            <button
                                onClick={handleFormSubmit}
                                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl font-semibold shadow-md hover:scale-[1.03] transition-transform duration-200"
                            >
                                Add
                            </button>
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-6 py-3 bg-gray-300 text-gray-800 rounded-xl font-semibold shadow-sm hover:bg-gray-400 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MeasurementBook;
