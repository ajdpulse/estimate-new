import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement, ItemLead, ItemMaterial } from '../../types';
import LoadingSpinner from '../common/LoadingSpinner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  X,
  Download,
  Settings,
  Eye,
  Printer,
  Save,
  Plus,
  Trash2,
  Calendar,
  FileText,
  Loader2
} from "lucide-react";

interface EstimateData {
  work: Work;
  subworks: SubWork[];
  subworkItems: { [subworkId: string]: SubworkItem[] };
  measurements: { [itemId: string]: ItemMeasurement[] };
  leads: { [itemId: string]: ItemLead[] };
  materials: { [itemId: string]: ItemMaterial[] };
}

interface DocumentSettings {
  header: {
    zilla: string;
    division: string;
    subDivision: string;
    title: string;
  };
  footer: {
    preparedBy: string;
    designation: string;
  };
  pageSettings: {
    showPageNumbers: boolean;
    pageNumberPosition: 'top' | 'bottom';
    marginTop: number;
    marginBottom: number;
  };
}

interface EstimatePDFGeneratorProps {
  workId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const EstimatePDFGenerator: React.FC<EstimatePDFGeneratorProps> = ({
  workId,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const printRef = useRef<HTMLDivElement>(null);

  // Default document settings
  const [documentSettings, setDocumentSettings] = useState<DocumentSettings>({
    header: {
      zilla: "ZILLA PARISHAD, CHANDRAPUR",
      division: "RURAL WATER SUPPLY DIVISION, Z.P., CHANDRAPUR",
      subDivision: "RURAL WATER SUPPLY SUB-DIVISION (Z.P.), CHANDRAPUR",
      title: "ESTIMATE"
    },
    footer: {
      preparedBy: "Pragati Bahu Uddeshiya Sanstha, Warora, Tah.- Chandrapur",
      designation: "Sub Divisional Engineer Z.P Rural Water supply Sub-Division, Chandrapur"
    },
    pageSettings: {
      showPageNumbers: true,
      pageNumberPosition: 'bottom',
      marginTop: 20,
      marginBottom: 20
    }
  });

  React.useEffect(() => {
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

      // Update document settings with work data
      if (work) {
        setDocumentSettings(prev => ({
          ...prev,
          header: {
            ...prev.header,
            division: work.division || prev.header.division,
            subDivision: work.sub_division || prev.header.subDivision
          }
        }));
      }

      // Fetch subworks
      const { data: subworks, error: subworksError } = await supabase
        .schema('estimate')
        .from('subworks')
        .select('*')
        .eq('works_id', workId)
        .order('sr_no');

      if (subworksError) throw subworksError;

      // Fetch subwork items for all subworks
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

        // Fetch measurements for each item using sr_no as subwork_item_id
        for (const item of items || []) {
          const { data: measurementsRes } = await supabase
            .schema('estimate')
            .from('item_measurements')
            .select('*')
            .eq('subwork_item_id', item.sr_no)
          measurements[item.sr_no] = measurementsRes || [];
        }
      }

      setEstimateData({
        work,
        subworks: subworks || [],
        subworkItems,
        measurements,
        leads: {},
        materials: {}
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

  const generatePDF = async () => {
    if (!printRef.current || !estimateData) return;

    try {
      setLoading(true);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 10;
      const contentWidth = pageWidth - (margin * 2);
      const contentHeight = pageHeight - (margin * 2);

      // Get all page elements
      const pages = printRef.current.querySelectorAll('.pdf-page');
      
      for (let i = 0; i < pages.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const pageElement = pages[i] as HTMLElement;
        const canvas = await html2canvas(pageElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          width: pageElement.scrollWidth,
          height: pageElement.scrollHeight
        });

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = contentWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // Add image to PDF
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, Math.min(imgHeight, contentHeight));

        // Add page number if enabled
        if (documentSettings.pageSettings.showPageNumbers) {
          const pageNum = i + 1;
          const totalPages = pages.length;
          const pageText = `Page ${pageNum} of ${totalPages}`;
          
          pdf.setFontSize(10);
          pdf.setTextColor(100);
          
          if (documentSettings.pageSettings.pageNumberPosition === 'bottom') {
            pdf.text(pageText, pageWidth / 2, pageHeight - 5, { align: 'center' });
          } else {
            pdf.text(pageText, pageWidth / 2, 10, { align: 'center' });
          }
        }
      }

      const fileName = `Estimate_${estimateData.work.works_id}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  const PageHeader: React.FC<{ pageNumber?: number }> = ({ pageNumber }) => (
    <div className="text-center mb-6 pb-4 border-b-2 border-gray-300">
      <h1 className="text-lg font-bold text-red-600 mb-2">{documentSettings.header.zilla}</h1>
      <h2 className="text-base font-semibold text-blue-600 mb-1">{documentSettings.header.division}</h2>
      <h3 className="text-sm font-medium text-blue-600 mb-3">{documentSettings.header.subDivision}</h3>
      {pageNumber && documentSettings.pageSettings.showPageNumbers && documentSettings.pageSettings.pageNumberPosition === 'top' && (
        <div className="text-xs text-gray-500">Page {pageNumber}</div>
      )}
    </div>
  );

  const PageFooter: React.FC<{ pageNumber?: number }> = ({ pageNumber }) => (
    <div className="mt-8 pt-4 border-t-2 border-gray-300">
      <div className="flex justify-between items-end">
        <div className="text-left">
          <p className="text-sm font-medium">Prepared By:</p>
          <p className="text-xs mt-2">{documentSettings.footer.preparedBy}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium">{documentSettings.footer.designation}</p>
        </div>
      </div>
      {pageNumber && documentSettings.pageSettings.showPageNumbers && documentSettings.pageSettings.pageNumberPosition === 'bottom' && (
        <div className="text-center text-xs text-gray-500 mt-2">Page {pageNumber}</div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-7xl shadow-lg rounded-md bg-white min-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Generate Estimate Report</h3>
          <div className="flex items-center space-x-2">
            {estimateData && (
              <>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </button>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </button>
                <button
                  onClick={generatePDF}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Generate PDF
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
            <h4 className="text-md font-medium text-gray-900 mb-4">Document Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Header Settings</h5>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Zilla Parishad"
                    value={documentSettings.header.zilla}
                    onChange={(e) => setDocumentSettings(prev => ({
                      ...prev,
                      header: { ...prev.header, zilla: e.target.value }
                    }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Division"
                    value={documentSettings.header.division}
                    onChange={(e) => setDocumentSettings(prev => ({
                      ...prev,
                      header: { ...prev.header, division: e.target.value }
                    }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Sub Division"
                    value={documentSettings.header.subDivision}
                    onChange={(e) => setDocumentSettings(prev => ({
                      ...prev,
                      header: { ...prev.header, subDivision: e.target.value }
                    }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Footer Settings</h5>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Prepared By"
                    value={documentSettings.footer.preparedBy}
                    onChange={(e) => setDocumentSettings(prev => ({
                      ...prev,
                      footer: { ...prev.footer, preparedBy: e.target.value }
                    }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                  <input
                    type="text"
                    placeholder="Designation"
                    value={documentSettings.footer.designation}
                    onChange={(e) => setDocumentSettings(prev => ({
                      ...prev,
                      footer: { ...prev.footer, designation: e.target.value }
                    }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  />
                </div>
              </div>
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">Page Settings</h5>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={documentSettings.pageSettings.showPageNumbers}
                      onChange={(e) => setDocumentSettings(prev => ({
                        ...prev,
                        pageSettings: { ...prev.pageSettings, showPageNumbers: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-xs">Show Page Numbers</span>
                  </label>
                  <select
                    value={documentSettings.pageSettings.pageNumberPosition}
                    onChange={(e) => setDocumentSettings(prev => ({
                      ...prev,
                      pageSettings: { ...prev.pageSettings, pageNumberPosition: e.target.value as 'top' | 'bottom' }
                    }))}
                    className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                  >
                    <option value="bottom">Page Numbers at Bottom</option>
                    <option value="top">Page Numbers at Top</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && !estimateData && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading estimate data...</span>
          </div>
        )}

        {estimateData && showPreview && (
          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[70vh] overflow-y-auto">
            <div ref={printRef} className="bg-white">
              
              {/* Page 1: Cover Page */}
              <div className="pdf-page bg-white p-8 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                <PageHeader pageNumber={1} />
                
                <div className="flex-1 flex flex-col justify-center">
                  <div className="text-center border-2 border-black p-8">
                    <h1 className="text-2xl font-bold underline mb-8">{documentSettings.header.title}</h1>
                    
                    <div className="mb-6">
                      <p className="text-lg font-semibold mb-2">{estimateData.work.work_name}</p>
                      <p className="text-base">
                        {estimateData.work.taluka && `Tah: ${estimateData.work.taluka}`}
                        {estimateData.work.taluka && estimateData.work.district && ', '}
                        {estimateData.work.district && `Dist:- ${estimateData.work.district}`}
                        {!estimateData.work.taluka && !estimateData.work.district && 'Tah: Chandrapur, Dist:- Chandrapur'}
                      </p>
                    </div>
                    
                    <div className="mb-8">
                      <p className="text-lg mb-2">( 2024-25)</p>
                      <p className="text-xl font-bold">ESTIMATED COST. Rs. {(estimateData.work.total_estimated_cost || calculateTotalEstimate()).toLocaleString('hi-IN')}</p>
                    </div>
                    
                    <div className="mt-12">
                      <p className="text-lg font-semibold mb-6">OFFICE OF THE</p>
                      <div className="flex justify-center space-x-8">
                        <div className="border border-black p-4 text-center min-w-[200px]">
                          <p className="text-sm">{estimateData.work.sub_division}</p>
                          <p className="text-sm">{estimateData.work.sub_division ? '' : 'Division, '}
                            {estimateData.work.district || 'Chandrapur'}.
                          </p>
                        </div>
                        <div className="border border-black p-4 text-center min-w-[200px]">
                          <p className="font-medium">{estimateData.work.sanctioning_authority || 'Executive Engineer'}</p>
                          <p className="text-sm">{estimateData.work.division}</p>
                          <p className="text-sm">Z.P, {estimateData.work.district || 'Chandrapur'}.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <PageFooter pageNumber={1} />
              </div>

              {/* Page 2: Details Page */}
              <div className="pdf-page bg-white p-8 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                <PageHeader pageNumber={2} />
                
                <div className="flex-1">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold underline">{documentSettings.header.title}</h3>
                    <p className="mt-2">{estimateData.work.work_name}</p>
                    <p>Tah: Chandrapur, Dist:- Chandrapur</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
                    <div className="space-y-3">
                      <div className="flex">
                        <span className="w-40 font-medium">Name of Division</span>
                        <span className="mr-2">:-</span>
                        <span>{estimateData.work.division || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="w-40 font-medium">Name of Sub- Division</span>
                        <span className="mr-2">:-</span>
                        <span>{estimateData.work.sub_division || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="w-40 font-medium">Fund Head</span>
                        <span className="mr-2">:-</span>
                        <span>{estimateData.work.fund_head || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="w-40 font-medium">Major Head</span>
                        <span className="mr-2">:-</span>
                        <span className="italic">{estimateData.work.major_head || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="w-40 font-medium">Minor Head</span>
                        <span className="mr-2">:-</span>
                        <span>{estimateData.work.minor_head || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="w-40 font-medium">Service Head</span>
                        <span className="mr-2">:-</span>
                        <span>{estimateData.work.service_head || '-'}</span>
                      </div>
                      <div className="flex">
                        <span className="w-40 font-medium">Departmental Head</span>
                        <span className="mr-2">:-</span>
                        <span>{estimateData.work.departmental_head || '-'}</span>
                      </div>
                    </div>
                    <div>
                      {/* Additional content can be added here if needed */}
                    </div>
                  </div>

                  <div className="mb-8">
                    <div className="flex justify-between items-center mb-6 text-lg">
                      <span className="font-bold">Estimated Cost Rs.</span>
                      <span className="font-bold">{calculateTotalEstimate().toLocaleString('hi-IN')}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex">
                          <span className="w-48 font-medium">Administrative Approval No.</span>
                          <span className="mr-2">:-</span>
                          <span>-</span>
                        </div>
                        <div className="flex">
                          <span className="w-48 font-medium">Technically Sanctioned under</span>
                          <span className="mr-2">:-</span>
                          <span>-</span>
                        </div>
                        <div className="flex">
                          <span className="w-48 font-medium">Estimate Prepared By</span>
                          <span className="mr-2">:-</span>
                          <span>{documentSettings.footer.preparedBy}</span>
                        </div>
                        <div className="flex">
                          <span className="w-48 font-medium">Checked By.</span>
                          <span className="mr-2">:-</span>
                          <span>-</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mb-6">
                    <h4 className="font-bold text-base">General Description</h4>
                    <p className="mt-2">------------------------- Attached Separately -------------------------</p>
                  </div>
                </div>
                
                <PageFooter pageNumber={2} />
              </div>

              {/* Page 3: Recapitulation Sheet */}
              <div className="pdf-page bg-white p-8 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                <PageHeader pageNumber={3} />
                
                <div className="flex-1">
                  <div className="text-center mb-6">
                    <p className="text-sm">Fund Head :- {estimateData.work.fund_head || 'SBM (G.) Phase-II & 15th Finance Commission'}</p>
                    <p className="text-sm font-semibold">NAME OF WORK: {estimateData.work.work_name}</p>
                    <p className="text-sm font-semibold">Village: {estimateData.work.village}</p>
                    <p className="text-sm font-semibold">GP : {estimateData.work.grampanchayat}</p>
                    <p className="text-sm font-semibold">Tah : {estimateData.work.taluka}</p>
                    <p className="text-sm">District :- Chandrapur</p>
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
                      {(() => {
                        let partAItems = [];
                        let partATotal = 0;
                        estimateData.subworks.forEach((subwork) => {
                          const items = estimateData.subworkItems[subwork.subworks_id] || [];
                          const filteredItems = items.filter(item => item.category === 'purchasing' || item.category === 'materials');
                          if (filteredItems.length > 0) {
                            filteredItems.forEach((item) => {
                              partAItems.push({ subwork, item });
                              partATotal += item.total_item_amount || 0;
                            });
                          }
                        });
                        return partAItems.map(({ subwork, item }, index) => {
                          const unitCount = item.ssr_quantity || 0;
                          const itemTotal = item.total_item_amount || 0;
                          return (
                            <tr key={`part-a-${item.id || index}`}>
                              <td className="border border-black p-2 text-center">{index + 1}</td>
                              <td className="border border-black p-2">{subwork.subworks_name}</td>
                              <td className="border border-black p-2">{item.description_of_item || 'N/A'}</td>
                              <td className="border border-black p-2 text-center">{unitCount}</td>
                              <td className="border border-black p-2 text-right">{itemTotal > 0 ? (itemTotal / Math.max(unitCount, 1)).toFixed(2) : '0.00'}</td>
                              <td className="border border-black p-2 text-right">{itemTotal.toFixed(2)}</td>
                              <td className="border border-black p-2 text-right">{(itemTotal * 0.7).toFixed(2)}</td>
                              <td className="border border-black p-2 text-right">{(itemTotal * 0.3).toFixed(2)}</td>
                            </tr>
                          );
                        });
                      })()}
                      
                      {/* Total of PART-A */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Total of PART - A</td>
                        <td className="border border-black p-2 text-right">{(() => {
                          let partATotal = 0;
                          estimateData.subworks.forEach((subwork) => {
                            const items = estimateData.subworkItems[subwork.subworks_id] || [];
                            const filteredItems = items.filter(item => item.category === 'purchasing' || item.category === 'materials');
                            filteredItems.forEach((item) => {
                              partATotal += item.total_item_amount || 0;
                            });
                          });
                          return partATotal.toFixed(2);
                        })()}</td>
                        <td className="border border-black p-2 text-right">{(() => {
                          let partATotal = 0;
                          estimateData.subworks.forEach((subwork) => {
                            const items = estimateData.subworkItems[subwork.subworks_id] || [];
                            const filteredItems = items.filter(item => item.category === 'purchasing' || item.category === 'materials');
                            filteredItems.forEach((item) => {
                              partATotal += item.total_item_amount || 0;
                            });
                          });
                          return (partATotal * 0.7).toFixed(2);
                        })()}</td>
                        <td className="border border-black p-2 text-right">{(() => {
                          let partATotal = 0;
                          estimateData.subworks.forEach((subwork) => {
                            const items = estimateData.subworkItems[subwork.subworks_id] || [];
                            const filteredItems = items.filter(item => item.category === 'purchasing' || item.category === 'materials');
                            filteredItems.forEach((item) => {
                              partATotal += item.total_item_amount || 0;
                            });
                          });
                          return (partATotal * 0.3).toFixed(2);
                        })()}</td>
                      </tr>

                      {/* PART-B: Construction works for E-Tendering */}
                      <tr className="bg-gray-200 font-bold">
                        <td colSpan={8} className="border border-black p-2">PART- B:- Construction works for E-Tendering</td>
                      </tr>
                      {(() => {
                        // Calculate Part B total first
                        let partBTotal = 0;
                        estimateData.subworks.forEach((subwork) => {
                          const items = estimateData.subworkItems[subwork.subworks_id] || [];
                          const filteredItems = items.filter(item => item.category === 'construction' || !item.category);
                          filteredItems.forEach((item) => {
                            partBTotal += item.total_item_amount || 0;
                          });
                        });
                        
                        // Now render the items
                        let partBItems = [];
                        
                        // Store partBTotal in a way that's accessible outside this IIFE
                        window.currentPartBTotal = partBTotal;
                        
                        estimateData.subworks.forEach((subwork) => {
                          const items = estimateData.subworkItems[subwork.subworks_id] || [];
                          const filteredItems = items.filter(item => item.category === 'construction' || !item.category);
                          if (filteredItems.length > 0) {
                            filteredItems.forEach((item) => {
                              partBItems.push({ subwork, item });
                            });
                          }
                        });
                        
                        // Store partBTotal in a way that's accessible outside this IIFE
                        window.currentPartBTotal = partBTotal;
                        
                        return partBItems.map(({ subwork, item }, index) => {
                          const unitCount = item.ssr_quantity || 0;
                          const itemTotal = item.total_item_amount || 0;
                          return (
                            <tr key={`part-b-${item.id || index}`}>
                              <td className="border border-black p-2 text-center">{index + 1}</td>
                              <td className="border border-black p-2">{subwork.subworks_name}</td>
                              <td className="border border-black p-2">{item.description_of_item || 'N/A'}</td>
                              <td className="border border-black p-2 text-center">{unitCount}</td>
                              <td className="border border-black p-2 text-right">{itemTotal > 0 ? (itemTotal / Math.max(unitCount, 1)).toFixed(2) : '0.00'}</td>
                              <td className="border border-black p-2 text-right">{itemTotal.toFixed(2)}</td>
                              <td className="border border-black p-2 text-right">{(itemTotal * 0.7).toFixed(2)}</td>
                              <td className="border border-black p-2 text-right">{(itemTotal * 0.3).toFixed(2)}</td>
                            </tr>
                          );
                        });
                      })()}
                      
                      {/* Total */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Total</td>
                        <td className="border border-black p-2 text-right">{(window.currentPartBTotal || 0).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{((window.currentPartBTotal || 0) * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{((window.currentPartBTotal || 0) * 0.3).toFixed(2)}</td>
                      </tr>

                      {/* Add 18% GST */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Add 18 % GST</td>
                        <td className="border border-black p-2 text-right">{((window.currentPartBTotal || 0) * 0.18).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{((window.currentPartBTotal || 0) * 0.18 * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{((window.currentPartBTotal || 0) * 0.18 * 0.3).toFixed(2)}</td>
                      </tr>

                      {/* Total of PART-B */}
                      <tr className="font-bold">
                        <td colSpan={5} className="border border-black p-2 text-right">Total of PART - B</td>
                        <td className="border border-black p-2 text-right">{((window.currentPartBTotal || 0) * 1.18).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{((window.currentPartBTotal || 0) * 1.18 * 0.7).toFixed(2)}</td>
                        <td className="border border-black p-2 text-right">{((window.currentPartBTotal || 0) * 1.18 * 0.3).toFixed(2)}</td>
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

              {/* Measurement Pages for Each Subwork */}
              {(() => {
                let pageNumber = 4;
                const measurementPages = [];
                
                estimateData.subworks.forEach((subwork) => {
                  const items = estimateData.subworkItems[subwork.subworks_id] || [];
                  
                  // Check if this subwork has any measurements
                  const hasAnyMeasurements = items.some(item => {
                    const itemMeasurements = estimateData.measurements[item.sr_no] || [];
                    return itemMeasurements.length > 0;
                  });
                  
                  // Only create measurement page if subwork has measurements
                  if (hasAnyMeasurements) {
                    measurementPages.push(
                      <div key={`measurement-${subwork.subworks_id}`} className="pdf-page bg-white p-6 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                        <PageHeader pageNumber={pageNumber} />
                        
                        <div className="flex-1">
                          {/* Traditional Header Format */}
                          <div className="text-center mb-6">
                            <p className="text-sm mb-2">Village :- {estimateData.work.village || 'N/A'}, GP :- {estimateData.work.grampanchayat || 'N/A'}, Tah :- {estimateData.work.taluka || 'N/A'}</p>
                            <h3 className="text-lg font-bold mb-4">Sub-Work :- {subwork.subworks_name}</h3>
                            <h4 className="text-lg font-bold underline">MEASUREMENT</h4>
                          </div>

                          {/* Traditional Measurement Table */}
                          <div className="mb-8">
                            <table className="w-full border-collapse border-2 border-black" style={{ borderCollapse: 'collapse' }}>
                              <thead>
                                <tr className="bg-white">
                                  <th className="border-2 border-black p-3 text-center font-bold text-sm" style={{ width: '50%', border: '2px solid black', padding: '9px', textAlign: 'center', fontWeight: 'bold' }}>
                                    Items
                                  </th>
                                  <th className="border-2 border-black p-3 text-center font-bold text-sm" style={{ width: '10%', border: '2px solid black', padding: '9px', textAlign: 'center', fontWeight: 'bold' }}>
                                    Nos.
                                  </th>
                                  <th className="border-2 border-black p-3 text-center font-bold text-sm" style={{ width: '10%', border: '2px solid black', padding: '9px', textAlign: 'center', fontWeight: 'bold' }}>
                                    Length
                                  </th>
                                  <th className="border-2 border-black p-3 text-center font-bold text-sm" style={{ width: '10%', border: '2px solid black', padding: '9px', textAlign: 'center', fontWeight: 'bold' }}>
                                    Breadth
                                  </th>
                                  <th className="border-2 border-black p-3 text-center font-bold text-sm" style={{ width: '9%', border: '2px solid black', padding: '9px', textAlign: 'center', fontWeight: 'bold' }}>
                                    Height/<br/>Depth
                                  </th>
                                  <th className="border-2 border-black p-3 text-center font-bold text-sm" style={{ width: '9%', border: '2px solid black', padding: '9px', textAlign: 'center', fontWeight: 'bold' }}>
                                    Qty.
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map((item, itemIndex) => {
                                  const itemMeasurements = estimateData.measurements[item.sr_no] || [];
                                  
                                  // Only show items that have measurements
                                  if (itemMeasurements.length === 0) return null;
                                  
                                  const itemTotal = itemMeasurements.reduce((sum, m) => sum + (m.calculated_quantity || 0), 0);
                                  
                                  return (
                                    <React.Fragment key={item.sr_no}>
                                      {/* Item Header Row */}
                                      <tr>
                                        <td className="border border-black p-3 font-bold text-sm" style={{ border: '1px solid black', padding: '12px', fontWeight: 'bold' }}>
                                          Item No.{itemIndex + 1} :-
                                        </td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                      </tr>
                                      
                                      {/* Item Description Row */}
                                      <tr>
                                        <td className="border border-black p-3 text-justify leading-tight text-sm" style={{ border: '1px solid black', padding: '12px', textAlign: 'justify', lineHeight: '1.3' }}>
                                          {item.description_of_item}
                                        </td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                      </tr>

                                      {/* Measurement Data Rows */}
                                      {itemMeasurements.map((measurement, measurementIndex) => (
                                        <tr key={measurement.sr_no || measurementIndex}>
                                          <td className="border border-black p-3 text-right pr-4 text-sm" style={{ border: '1px solid black', padding: '12px', textAlign: 'right', paddingRight: '16px' }}>
                                            {measurement.description_of_items || ''}
                                          </td>
                                          <td className="border border-black p-3 text-center text-sm font-medium" style={{ border: '1px solid black', padding: '12px', textAlign: 'center', fontWeight: '500' }}>
                                            {measurement.no_of_units || 1}
                                          </td>
                                          <td className="border border-black p-3 text-center text-sm font-medium" style={{ border: '1px solid black', padding: '12px', textAlign: 'center', fontWeight: '500' }}>
                                            {(measurement.length || 0).toFixed(2)}
                                          </td>
                                          <td className="border border-black p-3 text-center text-sm font-medium" style={{ border: '1px solid black', padding: '12px', textAlign: 'center', fontWeight: '500' }}>
                                            {(measurement.width_breadth || 0).toFixed(2)}
                                          </td>
                                          <td className="border border-black p-3 text-center text-sm font-medium" style={{ border: '1px solid black', padding: '12px', textAlign: 'center', fontWeight: '500' }}>
                                            {(measurement.height_depth || 0).toFixed(2)}
                                          </td>
                                          <td className="border border-black p-3 text-center text-sm font-bold text-blue-600" style={{ border: '1px solid black', padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb' }}>
                                            {(measurement.calculated_quantity || 0).toFixed(2)}
                                          </td>
                                        </tr>
                                      ))}

                                      {/* Total Row for Item */}
                                      <tr className="bg-gray-100">
                                        <td className="border border-black p-3 text-right font-bold text-sm pr-4" style={{ border: '1px solid black', padding: '12px', textAlign: 'right', fontWeight: 'bold', paddingRight: '16px' }}>
                                          Total
                                        </td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3" style={{ border: '1px solid black', padding: '12px' }}></td>
                                        <td className="border border-black p-3 text-center font-bold text-lg text-green-600" style={{ border: '1px solid black', padding: '12px', textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: '#16a34a' }}>
                                          {itemTotal.toFixed(2)}
                                        </td>
                                      </tr>

                                      {/* Spacing row between items */}
                                      {itemIndex < items.filter(i => (estimateData.measurements[i.sr_no] || []).length > 0).length - 1 && (
                                        <tr>
                                          <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }} colSpan={6}></td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        
                        <PageFooter pageNumber={pageNumber} />
                      </div>
                    );
                    pageNumber++;
                  }
                });
                
                return measurementPages;
              })()}

              {/* Sub-work Detail Pages */}
              {estimateData.subworks.map((subwork, subworkIndex) => {
                const items = estimateData.subworkItems[subwork.subworks_id] || [];
                if (items.length === 0) return null;

                return (
                  <div key={subwork.subworks_id} className="pdf-page bg-white p-8 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                    <PageHeader pageNumber={(() => {
                      // Calculate page number after measurement pages
                      let pageNum = 4;
                      estimateData.subworks.forEach((sw, idx) => {
                        if (idx <= subworkIndex) {
                          const swItems = estimateData.subworkItems[sw.subworks_id] || [];
                          const hasAnyMeasurements = swItems.some(item => {
                            const itemMeasurements = estimateData.measurements[item.sr_no] || [];
                            return itemMeasurements.length > 0;
                          });
                          if (hasAnyMeasurements && idx < subworkIndex) pageNum++;
                        }
                      });
                      return pageNum + subworkIndex;
                    })()} />
                    
                    <div className="flex-1">
                      <div className="text-center mb-6">
                        <p className="text-sm">Fund Head :- {estimateData.work.fund_head || '-'}</p>
                        <p className="text-sm">Village :- {estimateData.work.village || 'N/A'}, GP :- {estimateData.work.grampanchayat || 'N/A'}, Tah :- {estimateData.work.taluka || 'N/A'}</p>
                        <h3 className="text-lg font-bold mt-4">Sub-work: {subwork.subworks_name}</h3>
                      </div>

                      <table className="w-full border-collapse border border-black text-xs mb-6">
                        <thead>
                          <tr className="bg-gray-100">
                            <th className="border border-black p-2">Sr. No</th>
                            <th className="border border-black p-2">Description of Sub Work</th>
                            <th className="border border-black p-2">No.</th>
                            <th className="border border-black p-2">Unit</th>
                            <th className="border border-black p-2">Amount (Rs.)</th>
                            <th className="border border-black p-2">Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => (
                            <tr key={item.id}>
                              <td className="border border-black p-2 text-center">{index + 1}</td>
                              <td className="border border-black p-2">{item.description_of_item}</td>
                              <td className="border border-black p-2 text-center">{item.ssr_quantity}</td>
                              <td className="border border-black p-2 text-center">{item.ssr_unit}</td>
                              <td className="border border-black p-2 text-right">
                                {(item.ssr_rate || 0).toLocaleString('hi-IN')}
                              </td>
                              <td className="border border-black p-2 text-right">
                                {(item.total_item_amount || 0).toLocaleString('hi-IN')}
                              </td>
                            </tr>
                          ))}
                          <tr className="font-bold bg-gray-100">
                            <td colSpan={5} className="border border-black p-2 text-center">Total Rs</td>
                            <td className="border border-black p-2 text-right">
                              {items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0).toLocaleString('hi-IN')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <PageFooter pageNumber={(() => {
                      // Calculate page number after measurement pages
                      let pageNum = 4;
                      estimateData.subworks.forEach((sw, idx) => {
                        if (idx <= subworkIndex) {
                          const swItems = estimateData.subworkItems[sw.subworks_id] || [];
                          const hasAnyMeasurements = swItems.some(item => {
                            const itemMeasurements = estimateData.measurements[item.sr_no] || [];
                            return itemMeasurements.length > 0;
                          });
                          if (hasAnyMeasurements && idx < subworkIndex) pageNum++;
                        }
                      });
                      return pageNum + subworkIndex;
                    })()} />
                  </div>
                );
              })}

              {/* Measurement Pages - Traditional Format */}
              {(() => {
                let pageNumber = 4;
                const measurementPages = [];
                
                estimateData.subworks.forEach((subwork) => {
                  const items = estimateData.subworkItems[subwork.subworks_id] || [];
                  
                  // Check if this subwork has any measurements
                  const hasAnyMeasurements = items.some(item => {
                    const itemMeasurements = estimateData.measurements[item.id] || [];
                    return itemMeasurements.length > 0;
                  });
                  
                  // Only create measurement page if subwork has measurements
                  if (hasAnyMeasurements) {
                    measurementPages.push(
                      <div key={`measurement-${subwork.subworks_id}`} className="pdf-page bg-white p-6 min-h-[297mm] flex flex-col" style={{ fontFamily: 'Arial, sans-serif', pageBreakAfter: 'always' }}>
                        <PageHeader pageNumber={pageNumber} />
                        
                        <div className="flex-1">
                          {/* Traditional Measurement Header */}
                          <div className="text-center mb-6" style={{ fontSize: '14px', fontWeight: 'bold' }}>
                            <h2 className="text-base font-bold text-black mb-4">
                              NAME OF WORK: {estimateData.work.work_name}
                            </h2>
                            
                            {/* Location Information */}
                            <div className="text-sm text-black mb-4">
                              <span>Village :- {estimateData.work.village || 'N/A'}, </span>
                              <span>GP :- {estimateData.work.grampanchayat || 'N/A'}, </span>
                              <span>Tah :- {estimateData.work.taluka || 'Chandrapur'}</span>
                            </div>
                            
                            <h3 className="text-base font-bold text-black mb-4">
                              Sub-Work :- {subwork.subworks_name}
                            </h3>
                            
                            <h2 className="text-lg font-bold text-black underline mb-6">
                              MEASUREMENT
                            </h2>
                          </div>

                          {/* Traditional Measurement Table */}
                          <table className="w-full border-collapse border-2 border-black text-sm" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                              <tr>
                                <th className="border border-black p-3 text-center font-bold" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', width: '40%' }}>
                                  Items
                                </th>
                                <th className="border border-black p-3 text-center font-bold" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', width: '10%' }}>
                                  Nos.
                                </th>
                                <th className="border border-black p-3 text-center font-bold" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', width: '12%' }}>
                                  Length
                                </th>
                                <th className="border border-black p-3 text-center font-bold" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', width: '12%' }}>
                                  Breadth
                                </th>
                                <th className="border border-black p-3 text-center font-bold" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', width: '13%' }}>
                                  Height/<br/>Depth
                                </th>
                                <th className="border border-black p-3 text-center font-bold" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', width: '13%' }}>
                                  Qty.
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item, itemIndex) => {
                                const itemMeasurements = estimateData.measurements[item.id] || [];
                                
                                // Only show items that have measurements
                                if (itemMeasurements.length === 0) return null;
                                
                                const rows = [];
                                
                                // Item header row
                                rows.push(
                                  <tr key={`item-header-${item.id}`}>
                                    <td className="border border-black p-2 font-bold" style={{ border: '1px solid black', padding: '8px', fontWeight: 'bold' }}>
                                      Item No.{itemIndex + 1} :-
                                    </td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                  </tr>
                                );
                                
                                // Item description row
                                rows.push(
                                  <tr key={`item-desc-${item.id}`}>
                                    <td className="border border-black p-2 text-justify leading-tight" style={{ border: '1px solid black', padding: '8px', textAlign: 'justify', lineHeight: '1.3' }}>
                                      {item.description_of_item}
                                    </td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                  </tr>
                                );

                                // Measurement data rows
                                itemMeasurements.forEach((measurement, measurementIndex) => {
                                  rows.push(
                                    <tr key={`measurement-${measurement.sr_no || measurementIndex}`}>
                                      <td className="border border-black p-2 text-right pr-4" style={{ border: '1px solid black', padding: '8px', textAlign: 'right', paddingRight: '16px' }}>
                                        {measurement.description_of_items || ''}
                                      </td>
                                      <td className="border border-black p-2 text-center" style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                                        {measurement.no_of_units || 1}
                                      </td>
                                      <td className="border border-black p-2 text-center" style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                                        {(measurement.length || 0).toFixed(2)}
                                      </td>
                                      <td className="border border-black p-2 text-center" style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                                        {(measurement.width_breadth || 0).toFixed(2)}
                                      </td>
                                      <td className="border border-black p-2 text-center" style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                                        {(measurement.height_depth || 0).toFixed(2)}
                                      </td>
                                      <td className="border border-black p-2 text-center" style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                                        {(measurement.calculated_quantity || 0).toFixed(2)}
                                      </td>
                                    </tr>
                                  );
                                });

                                // Total row for this item
                                const totalQuantity = itemMeasurements.reduce((sum, m) => sum + (m.calculated_quantity || 0), 0);
                                rows.push(
                                  <tr key={`total-${item.id}`}>
                                    <td className="border border-black p-2 text-right font-bold pr-4" style={{ border: '1px solid black', padding: '8px', textAlign: 'right', fontWeight: 'bold', paddingRight: '16px' }}>
                                      Total
                                    </td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                    <td className="border border-black p-2 text-center font-bold" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>
                                      {totalQuantity.toFixed(2)}
                                    </td>
                                  </tr>
                                );

                                // Add spacing row between items (except for last item)
                                const itemsWithMeasurements = items.filter(i => (estimateData.measurements[i.id] || []).length > 0);
                                if (itemIndex < itemsWithMeasurements.length - 1) {
                                  rows.push(
                                    <tr key={`spacing-${item.id}`}>
                                      <td className="border border-black p-1" colSpan={6} style={{ border: '1px solid black', padding: '4px' }}></td>
                                    </tr>
                                  );
                                }

                                return rows;
                              })}
                              
                              {/* Add some empty rows for manual entries */}
                              {Array.from({ length: 8 }, (_, index) => (
                                <tr key={`empty-${index}`}>
                                  <td className="border border-black p-2 h-8" style={{ border: '1px solid black', padding: '8px', height: '32px' }}></td>
                                  <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                  <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                  <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                  <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                  <td className="border border-black p-2" style={{ border: '1px solid black', padding: '8px' }}></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        
                        <PageFooter pageNumber={pageNumber} />
                      </div>
                    );
                    pageNumber++;
                  }
                });
                
                return measurementPages;
              })()}
            </div>
          </div>
        )}

        {!loading && !estimateData && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No estimate data found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Unable to load estimate data for the selected work.
            </p>
          </div>
        )}
      </div>

      <style jsx>{`
        @media print {
          .pdf-page {
            page-break-after: always;
            min-height: 297mm;
            width: 210mm;
          }
        }
        
        .pdf-page {
          box-shadow: 0 0 10px rgba(0,0,0,0.1);
          margin-bottom: 20px;
        }
      `}</style>
    </div>
  );
};

export default EstimatePDFGenerator;