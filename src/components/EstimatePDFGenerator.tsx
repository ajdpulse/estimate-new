import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement, ItemLead, ItemMaterial } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { 
  FileText, 
  Download, 
  X, 
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Calculator
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface TaxSetting {
  id: string;
  name: string;
  percentage: number;
  enabled: boolean;
}

interface EstimateData {
  work: Work;
  subworks: SubWork[];
  subworkItems: { [subworkId: string]: SubworkItem[] };
  measurements: { [itemId: string]: ItemMeasurement[] };
  leads: { [itemId: string]: ItemLead[] };
  materials: { [itemId: string]: ItemMaterial[] };
}

interface EstimatePDFGeneratorProps {
  workId: string;
  taxSettings: TaxSetting[];
  onTaxSettingsChange: (settings: TaxSetting[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

const EstimatePDFGenerator: React.FC<EstimatePDFGeneratorProps> = ({
  workId,
  taxSettings,
  onTaxSettingsChange,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const [showPreview, setShowPreview] = useState(false);
  
  // Document settings
  const [headerSettings, setHeaderSettings] = useState({
    line1: 'ZILLA PARISHAD, CHANDRAPUR',
    line2: 'Rural Water Supply, Division, Z.P. Chandrapur',
    line3: 'Rural Water Supply Sub-Division Chandrapur'
  });
  
  const [footerSettings, setFooterSettings] = useState({
    line1: 'Pragati Bahu Uddeshiya Sanstha, Warora, Tah.- Chandrapur',
    line2: 'Sub Divisional Engineer Z.P Rural Water supply Sub-Division, Chandrapur'
  });
  
  const [pageSettings, setPageSettings] = useState({
    showPageNumbers: true,
    pageNumberPosition: 'bottom'
  });

  // Tax settings state
  const [newTaxName, setNewTaxName] = useState('');
  const [newTaxPercentage, setNewTaxPercentage] = useState('');

  useEffect(() => {
    if (isOpen && workId) {
      fetchEstimateData();
    }
  }, [isOpen, workId]);

  const fetchEstimateData = async () => {
    try {
      setLoading(true);

      // Fetch work details
      const { data: work, error: workError } = await supabase
        .schema('estimate')
        .from('works')
        .select('*')
        .eq('works_id', workId)
        .single();

      if (workError) throw workError;

      // Fetch subworks
      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no');

      if (subworksError) throw subworksError;

      // Fetch all related data
      const subworkItems: { [subworkId: string]: SubworkItem[] } = {};
      const measurements: { [itemId: string]: ItemMeasurement[] } = {};
      const leads: { [itemId: string]: ItemLead[] } = {};
      const materials: { [itemId: string]: ItemMaterial[] } = {};

      for (const subwork of subworks || []) {
        const { data: items } = await supabase
          .schema('estimate')
          .from('subwork_items')
          .select('*')
          .eq('subwork_id', subwork.subworks_id)
          .order('sr_no');

        subworkItems[subwork.subworks_id] = items || [];

        // Fetch measurements, leads, and materials for each item
        for (const item of items || []) {
          const [measurementsRes, leadsRes, materialsRes] = await Promise.all([
            supabase.schema('estimate').from('item_measurements').select('*').eq('subwork_item_id', item.sr_no),
            supabase.schema('estimate').from('item_leads').select('*').eq('subwork_item_sr_no', item.sr_no),
            supabase.schema('estimate').from('item_materials').select('*').eq('subwork_item_sr_no', item.sr_no)
          ]);

          measurements[item.id] = measurementsRes.data || [];
          leads[item.id] = leadsRes.data || [];
          materials[item.id] = materialsRes.data || [];
        }
      }

      setEstimateData({
        work,
        subworks: subworks || [],
        subworkItems,
        measurements,
        leads,
        materials
      });

    } catch (error) {
      console.error('Error fetching estimate data:', error);
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

  const calculateTotalEstimate = () => {
    if (!estimateData) return 0;
    
    let total = 0;
    estimateData.subworks.forEach(subwork => {
      const items = estimateData.subworkItems[subwork.subworks_id] || [];
      items.forEach(item => {
        total += item.total_item_amount || 0;
      });
    });
    
    return total;
  };

  const handleTaxToggle = (taxId: string) => {
    const updatedTaxes = taxSettings.map(tax => 
      tax.id === taxId ? { ...tax, enabled: !tax.enabled } : tax
    );
    onTaxSettingsChange(updatedTaxes);
  };

  const handleTaxPercentageChange = (taxId: string, percentage: number) => {
    const updatedTaxes = taxSettings.map(tax => 
      tax.id === taxId ? { ...tax, percentage } : tax
    );
    onTaxSettingsChange(updatedTaxes);
  };

  const handleRemoveTax = (taxId: string) => {
    const updatedTaxes = taxSettings.filter(tax => tax.id !== taxId);
    onTaxSettingsChange(updatedTaxes);
  };

  const handleAddTax = () => {
    if (!newTaxName.trim() || !newTaxPercentage) return;
    
    const newTax = {
      id: Date.now().toString(),
      name: newTaxName.trim(),
      percentage: parseFloat(newTaxPercentage),
      enabled: true
    };
    
    onTaxSettingsChange([...taxSettings, newTax]);
    setNewTaxName('');
    setNewTaxPercentage('');
  };

  const generatePDF = async () => {
    if (!estimateData) return;

    try {
      setGenerating(true);

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      let yPosition = 20;

      // Header
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(headerSettings.line1, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 8;

      pdf.setFontSize(12);
      pdf.text(headerSettings.line2, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 6;

      pdf.setFontSize(10);
      pdf.text(headerSettings.line3, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 15;

      // Work details
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('ESTIMATE DETAILS', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Work ID: ${estimateData.work.works_id}`, 20, yPosition);
      yPosition += 6;
      pdf.text(`Work Name: ${estimateData.work.work_name}`, 20, yPosition);
      yPosition += 6;
      pdf.text(`Division: ${estimateData.work.division || 'N/A'}`, 20, yPosition);
      yPosition += 15;

      // Estimate table
      const tableData: any[] = [];
      let srNo = 1;

      estimateData.subworks.forEach(subwork => {
        const items = estimateData.subworkItems[subwork.subworks_id] || [];
        
        // Add subwork header
        tableData.push([
          { content: subwork.subworks_name, colSpan: 6, styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
        ]);

        items.forEach(item => {
          tableData.push([
            srNo++,
            item.item_number || '',
            item.description_of_item,
            item.ssr_quantity || 0,
            item.ssr_unit || '',
            formatCurrency(item.total_item_amount || 0)
          ]);
        });
      });

      // Calculate totals
      const subtotal = calculateTotalEstimate();
      const enabledTaxes = taxSettings.filter(tax => tax.enabled);
      let totalTaxAmount = 0;

      enabledTaxes.forEach(tax => {
        totalTaxAmount += (subtotal * tax.percentage) / 100;
      });

      const grandTotal = subtotal + totalTaxAmount;

      // Add totals to table
      tableData.push([
        { content: 'SUBTOTAL', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' } },
        { content: formatCurrency(subtotal), styles: { fontStyle: 'bold' } }
      ]);

      enabledTaxes.forEach(tax => {
        const taxAmount = (subtotal * tax.percentage) / 100;
        tableData.push([
          { content: `${tax.name} (${tax.percentage}%)`, colSpan: 5, styles: { halign: 'right' } },
          formatCurrency(taxAmount)
        ]);
      });

      tableData.push([
        { content: 'GRAND TOTAL', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right', fillColor: [220, 220, 220] } },
        { content: formatCurrency(grandTotal), styles: { fontStyle: 'bold', fillColor: [220, 220, 220] } }
      ]);

      (pdf as any).autoTable({
        head: [['Sr.', 'Item No.', 'Description', 'Qty', 'Unit', 'Amount (₹)']],
        body: tableData,
        startY: yPosition,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [100, 100, 100] },
        margin: { left: 20, right: 20 }
      });

      // Footer
      const finalY = (pdf as any).lastAutoTable.finalY + 20;
      pdf.setFontSize(8);
      pdf.text(footerSettings.line1, pageWidth / 2, finalY, { align: 'center' });
      pdf.text(footerSettings.line2, pageWidth / 2, finalY + 5, { align: 'center' });

      // Page numbers
      if (pageSettings.showPageNumbers) {
        const pageCount = pdf.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
        }
      }

      // Save PDF
      pdf.save(`Estimate_${estimateData.work.works_id}.pdf`);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-hidden">
      <div className="h-full flex bg-white">
        
        {/* Settings Panel */}
        {showSettings && (
          <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Document Settings</h2>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <EyeOff className="w-4 h-4" />
                </button>
              </div>

              {/* Header Settings */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Header Settings</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={headerSettings.line1}
                    onChange={(e) => setHeaderSettings({...headerSettings, line1: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={headerSettings.line2}
                    onChange={(e) => setHeaderSettings({...headerSettings, line2: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={headerSettings.line3}
                    onChange={(e) => setHeaderSettings({...headerSettings, line3: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Footer Settings */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Footer Settings</h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={footerSettings.line1}
                    onChange={(e) => setFooterSettings({...footerSettings, line1: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={footerSettings.line2}
                    onChange={(e) => setFooterSettings({...footerSettings, line2: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Page Settings */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Page Settings</h3>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showPageNumbers"
                    checked={pageSettings.showPageNumbers}
                    onChange={(e) => setPageSettings({...pageSettings, showPageNumbers: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="showPageNumbers" className="text-sm text-gray-700">
                    Show Page Numbers
                  </label>
                </div>
                <select
                  value={pageSettings.pageNumberPosition}
                  onChange={(e) => setPageSettings({...pageSettings, pageNumberPosition: e.target.value})}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bottom">Page Numbers at Bottom</option>
                  <option value="top">Page Numbers at Top</option>
                </select>
              </div>

              {/* Tax Settings */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Tax Settings for Recap Sheet</h3>
                
                {/* Current Taxes */}
                <div className="space-y-3 mb-4">
                  {taxSettings.map((tax) => (
                    <div key={tax.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={tax.enabled}
                          onChange={() => handleTaxToggle(tax.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className={`text-sm font-medium ${tax.enabled ? 'text-gray-900' : 'text-gray-500'}`}>
                          {tax.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="number"
                          value={tax.percentage}
                          onChange={(e) => handleTaxPercentageChange(tax.id, parseFloat(e.target.value) || 0)}
                          className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          step="0.1"
                          min="0"
                          max="100"
                        />
                        <span className="text-sm text-gray-600">%</span>
                        <button
                          onClick={() => handleRemoveTax(tax.id)}
                          className="text-red-600 hover:text-red-800 p-1 rounded"
                          title="Remove Tax"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add New Tax */}
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h5 className="text-sm font-medium text-blue-900 mb-2">Add New Tax</h5>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      placeholder="Tax name"
                      value={newTaxName}
                      onChange={(e) => setNewTaxName(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Rate"
                      value={newTaxPercentage}
                      onChange={(e) => setNewTaxPercentage(e.target.value)}
                      className="w-20 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      step="0.1"
                      min="0"
                      max="100"
                    />
                    <button
                      onClick={handleAddTax}
                      disabled={!newTaxName.trim() || !newTaxPercentage}
                      className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Tax Preview */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Preview (Sample ₹1,00,000)</h5>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>₹1,00,000</span>
                    </div>
                    {taxSettings.filter(tax => tax.enabled).map((tax) => {
                      const amount = (100000 * tax.percentage) / 100;
                      return (
                        <div key={tax.id} className="flex justify-between text-blue-600">
                          <span>{tax.name} ({tax.percentage}%):</span>
                          <span>₹{amount.toLocaleString('hi-IN')}</span>
                        </div>
                      );
                    })}
                    <hr className="my-2" />
                    <div className="flex justify-between font-bold">
                      <span>Grand Total:</span>
                      <span>
                        ₹{(100000 + taxSettings.filter(tax => tax.enabled).reduce((sum, tax) => sum + (100000 * tax.percentage) / 100, 0)).toLocaleString('hi-IN')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center space-x-3">
              <FileText className="h-6 w-6 text-blue-600" />
              <h1 className="text-xl font-semibold text-gray-900">Generate Estimate Report</h1>
            </div>
            
            <div className="flex items-center space-x-3">
              {!showSettings && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Settings
                </button>
              )}
              
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {showPreview ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </button>
              
              <button
                onClick={generatePDF}
                disabled={generating || !estimateData}
                className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Generate PDF
                  </>
                )}
              </button>
              
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <LoadingSpinner text="Loading estimate data..." />
              </div>
            ) : estimateData ? (
              <div className="p-6">
                {showPreview ? (
                  <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
                    {/* Preview content */}
                    <div className="text-center mb-8">
                      <h1 className="text-xl font-bold text-red-600 mb-2">{headerSettings.line1}</h1>
                      <h2 className="text-lg text-blue-600 mb-1">{headerSettings.line2}</h2>
                      <h3 className="text-base text-blue-600">{headerSettings.line3}</h3>
                    </div>
                    
                    <div className="mb-6">
                      <h2 className="text-lg font-bold text-center mb-4">ESTIMATE DETAILS</h2>
                      <div className="text-sm space-y-1">
                        <p><strong>Work ID:</strong> {estimateData.work.works_id}</p>
                        <p><strong>Work Name:</strong> {estimateData.work.work_name}</p>
                        <p><strong>Division:</strong> {estimateData.work.division || 'N/A'}</p>
                      </div>
                    </div>

                    {/* Estimate table preview */}
                    <div className="overflow-x-auto mb-6">
                      <table className="min-w-full border border-gray-300 text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border border-gray-300 px-2 py-1">Sr.</th>
                            <th className="border border-gray-300 px-2 py-1">Item No.</th>
                            <th className="border border-gray-300 px-2 py-1">Description</th>
                            <th className="border border-gray-300 px-2 py-1">Qty</th>
                            <th className="border border-gray-300 px-2 py-1">Unit</th>
                            <th className="border border-gray-300 px-2 py-1">Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {estimateData.subworks.map((subwork, subworkIndex) => {
                            const items = estimateData.subworkItems[subwork.subworks_id] || [];
                            return (
                              <React.Fragment key={subwork.subworks_id}>
                                <tr>
                                  <td colSpan={6} className="border border-gray-300 px-2 py-1 font-bold bg-gray-50">
                                    {subwork.subworks_name}
                                  </td>
                                </tr>
                                {items.map((item, itemIndex) => (
                                  <tr key={item.id}>
                                    <td className="border border-gray-300 px-2 py-1 text-center">
                                      {subworkIndex + 1}.{itemIndex + 1}
                                    </td>
                                    <td className="border border-gray-300 px-2 py-1">{item.item_number || ''}</td>
                                    <td className="border border-gray-300 px-2 py-1">{item.description_of_item}</td>
                                    <td className="border border-gray-300 px-2 py-1 text-center">{item.ssr_quantity || 0}</td>
                                    <td className="border border-gray-300 px-2 py-1 text-center">{item.ssr_unit || ''}</td>
                                    <td className="border border-gray-300 px-2 py-1 text-right">
                                      {formatCurrency(item.total_item_amount || 0)}
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            );
                          })}
                          
                          {/* Totals */}
                          <tr className="bg-gray-50">
                            <td colSpan={5} className="border border-gray-300 px-2 py-1 text-right font-bold">
                              SUBTOTAL:
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right font-bold">
                              {formatCurrency(calculateTotalEstimate())}
                            </td>
                          </tr>
                          
                          {taxSettings.filter(tax => tax.enabled).map((tax) => {
                            const taxAmount = (calculateTotalEstimate() * tax.percentage) / 100;
                            return (
                              <tr key={tax.id}>
                                <td colSpan={5} className="border border-gray-300 px-2 py-1 text-right">
                                  {tax.name} ({tax.percentage}%):
                                </td>
                                <td className="border border-gray-300 px-2 py-1 text-right">
                                  {formatCurrency(taxAmount)}
                                </td>
                              </tr>
                            );
                          })}
                          
                          <tr className="bg-gray-100">
                            <td colSpan={5} className="border border-gray-300 px-2 py-1 text-right font-bold">
                              GRAND TOTAL:
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-right font-bold">
                              {formatCurrency(
                                calculateTotalEstimate() + 
                                taxSettings.filter(tax => tax.enabled).reduce((sum, tax) => 
                                  sum + (calculateTotalEstimate() * tax.percentage) / 100, 0
                                )
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="text-center text-sm text-gray-600 mt-8">
                      <p>{footerSettings.line1}</p>
                      <p>{footerSettings.line2}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16">
                    <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">PDF Preview</h3>
                    <p className="text-gray-500 mb-4">
                      Click "Show Preview" to see how your PDF will look, or "Generate PDF" to download.
                    </p>
                    <div className="flex items-center justify-center space-x-4">
                      <button
                        onClick={() => setShowPreview(true)}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Show Preview
                      </button>
                      <button
                        onClick={generatePDF}
                        disabled={generating}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Generate PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
                  <p className="text-gray-500">Unable to load estimate data for the selected work.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstimatePDFGenerator;