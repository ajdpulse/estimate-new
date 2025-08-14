import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Work, SubWork, SubworkItem, ItemMeasurement, ItemLead, ItemMaterial } from '../types';
import { FileText, Download, Loader2, Eye } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

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
  isOpen: boolean;
  onClose: () => void;
}

const EstimatePDFGenerator: React.FC<EstimatePDFGeneratorProps> = ({
  workId,
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [estimateData, setEstimateData] = useState<EstimateData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Document constants from the provided format
  const DOCUMENT_HEADER = {
    zilla: "ZILLA PARISHAD, CHANDRAPUR",
    division: "RURAL WATER SUPPLY DIVISION, Z.P., CHANDRAPUR",
    subDivision: "RURAL WATER SUPPLY SUB-DIVISION (Z.P.), CHANDRAPUR",
    title: "ESTIMATE"
  };

  const DOCUMENT_FOOTER = {
    preparedBy: "Pragati Bahu Uddeshiya Sanstha, Warora, Tah.- Chandrapur",
    designation: "Sub Divisional Engineer Z.P Rural Water supply Sub-Division, Chandrapur"
  };

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

        // Fetch measurements, leads, and materials for each item
        for (const item of items || []) {
          const [measurementsRes, leadsRes, materialsRes] = await Promise.all([
            supabase.schema('estimate').from('item_measurements').select('*').eq('subwork_item_id', item.sr_no),
            supabase.schema('estimate').from('item_leads').select('*').eq('subwork_item_id', item.sr_no),
            supabase.schema('estimate').from('item_materials').select('*').eq('subwork_item_id', item.sr_no)
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

  const generatePDF = async () => {
    if (!printRef.current || !estimateData) return;

    try {
      setLoading(true);
      
      const element = printRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fileName = `Estimate_${estimateData.work.works_id}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-11/12 max-w-6xl shadow-lg rounded-md bg-white min-h-[90vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Generate Estimate Report</h3>
          <div className="flex items-center space-x-2">
            {estimateData && (
              <>
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

        {loading && !estimateData && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading estimate data...</span>
          </div>
        )}

        {estimateData && showPreview && (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div ref={printRef} className="bg-white p-8" style={{ fontFamily: 'Arial, sans-serif' }}>
              {/* Cover Page */}
              <div className="text-center mb-8 page-break-after">
                <div className="border-2 border-black p-6">
                  <h1 className="text-xl font-bold text-red-600 mb-4">{DOCUMENT_HEADER.zilla}</h1>
                  <h2 className="text-lg font-semibold text-blue-600 mb-2">{DOCUMENT_HEADER.division}</h2>
                  <h3 className="text-base font-medium text-blue-600 mb-6">{DOCUMENT_HEADER.subDivision}</h3>
                  
                  <h1 className="text-2xl font-bold underline mb-6">{DOCUMENT_HEADER.title}</h1>
                  
                  <div className="mb-4">
                    <p className="font-semibold">{estimateData.work.work_name}</p>
                    <p>Tah: Chandrapur, Dist:- Chandrapur</p>
                  </div>
                  
                  <div className="mb-6">
                    <p className="text-lg">( 2024-25)</p>
                    <p className="font-semibold">ESTIMATED COST. Rs. {calculateTotalEstimate().toLocaleString('hi-IN')}</p>
                  </div>
                  
                  <div className="mt-8">
                    <p className="font-semibold mb-4">OFFICE OF THE</p>
                    <div className="flex justify-center space-x-8">
                      <div className="border border-black p-3 text-center">
                        <p className="font-medium">Sub Divisional Engineer</p>
                        <p className="text-sm">Rural Water Supply(Z.P.) Sub-</p>
                        <p className="text-sm">Division, Chandrapur.</p>
                      </div>
                      <div className="border border-black p-3 text-center">
                        <p className="font-medium">Executive Engineer</p>
                        <p className="text-sm">Rural Water Supply Dn.</p>
                        <p className="text-sm">Z.P, Chandrapur.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Details Page */}
              <div className="mb-8 page-break-before">
                <div className="text-center mb-6">
                  <h1 className="font-bold">{DOCUMENT_HEADER.zilla}</h1>
                  <h2 className="font-semibold">{DOCUMENT_HEADER.division}</h2>
                  <p>{estimateData.work.work_name}</p>
                  <p>Tah: Chandrapur, Dist:- Chandrapur</p>
                  <h3 className="font-bold text-lg mt-4">{DOCUMENT_HEADER.title}</h3>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                  <div>
                    <div className="flex mb-2">
                      <span className="w-32">Name of Division</span>
                      <span className="mr-2">:-</span>
                      <span>{estimateData.work.division || 'Rural Water Supply, Division, Z.P. Chandrapur'}</span>
                    </div>
                    <div className="flex mb-2">
                      <span className="w-32">Name of Sub- Division</span>
                      <span className="mr-2">:-</span>
                      <span>{estimateData.work.sub_division || 'Rural Water Supply Sub-Division Chandrapur'}</span>
                    </div>
                    <div className="flex mb-2">
                      <span className="w-32">Sanction Estimate No.</span>
                      <span className="mr-2">:-</span>
                      <span></span>
                    </div>
                    <div className="flex mb-2">
                      <span className="w-32">Fund Head</span>
                      <span className="mr-2">:-</span>
                      <span>{estimateData.work.fund_head}</span>
                    </div>
                    <div className="flex mb-2">
                      <span className="w-32">Major Head</span>
                      <span className="mr-2">:-</span>
                      <span className="italic">{estimateData.work.major_head || '"SBM (G.) Phase-II & 15th Finance Commission - 2024-25"'}</span>
                    </div>
                    <div className="flex mb-2">
                      <span className="w-32">Minor Head</span>
                      <span className="mr-2">:-</span>
                      <span>{estimateData.work.minor_head}</span>
                    </div>
                    <div className="flex mb-2">
                      <span className="w-32">Service Head</span>
                      <span className="mr-2">:-</span>
                      <span>{estimateData.work.service_head}</span>
                    </div>
                    <div className="flex mb-2">
                      <span className="w-32">Departmental Head</span>
                      <span className="mr-2">:-</span>
                      <span>{estimateData.work.departmental_head}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-justify">
                      Estimate is framed in the Office of the Sub Divisional Engineer, Rural Water Supply, Sub Division (Z.P.), 
                      Narkhed for probable expenditure that will be incurred under Estimate For {estimateData.work.work_name}. 
                      At :- Nakoda, Taluka :- Chandrapur, District Chandrapur.
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold">Estimated Cost Rs.</span>
                    <span className="font-bold">{calculateTotalEstimate().toLocaleString('hi-IN')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="flex mb-2">
                        <span className="w-40">Administrative Approval No.</span>
                        <span className="mr-2">:-</span>
                        <span></span>
                      </div>
                      <div className="flex mb-2">
                        <span className="w-40">Technically Sanctioned under</span>
                        <span className="mr-2">:-</span>
                        <span></span>
                      </div>
                      <div className="flex mb-2">
                        <span className="w-40">Estimate Prepared By</span>
                        <span className="mr-2">:-</span>
                        <span>{DOCUMENT_FOOTER.preparedBy}</span>
                      </div>
                      <div className="flex mb-2">
                        <span className="w-40">Checked By.</span>
                        <span className="mr-2">:-</span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center mb-4">
                  <h4 className="font-bold">General Description</h4>
                  <p>------------------------- Attached Separately -------------------------</p>
                </div>

                <div className="text-right mt-8">
                  <p className="font-medium">Sub Divisional Engineer</p>
                  <p>Rural Water Supply Sub-Division</p>
                  <p>Chandrapur</p>
                </div>
              </div>

              {/* Recapitulation Sheet */}
              <div className="mb-8 page-break-before">
                <div className="text-center mb-6">
                  <h1 className="font-bold">{DOCUMENT_HEADER.zilla}</h1>
                  <h2 className="font-semibold">{DOCUMENT_HEADER.division}</h2>
                  <p>Fund Head :- {estimateData.work.fund_head || 'SBM (G.) Phase-II & 15th Finance Commission'}</p>
                  <p>NAME OF WORK: {estimateData.work.work_name}</p>
                  <p>Village :- Nakoda, GP :- Nakoda, Tah :- Chandrapur</p>
                  <h3 className="font-bold text-lg mt-4">RECAPITULATION SHEET</h3>
                </div>

                <table className="w-full border-collapse border border-black text-xs">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-black p-2">Sr. No</th>
                      <th className="border border-black p-2">Type of work</th>
                      <th className="border border-black p-2">Item of Work</th>
                      <th className="border border-black p-2">No. of unit</th>
                      <th className="border border-black p-2">Amount per unit (Rs.)</th>
                      <th className="border border-black p-2">Total Amount (Rs.)</th>
                      <th className="border border-black p-2">SBM (G) (70%) (Rs.)</th>
                      <th className="border border-black p-2">Source of Fund Convergence-15th Finance Commission (30%) (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estimateData.subworks.map((subwork, index) => {
                      const items = estimateData.subworkItems[subwork.subworks_id] || [];
                      const subworkTotal = items.reduce((sum, item) => sum + (item.total_item_amount || 0), 0);
                      
                      return (
                        <tr key={subwork.subworks_id}>
                          <td className="border border-black p-2 text-center">{index + 1}</td>
                          <td className="border border-black p-2">{subwork.subworks_name}</td>
                          <td className="border border-black p-2">
                            {items.map(item => item.description_of_item).join(', ')}
                          </td>
                          <td className="border border-black p-2 text-center">
                            {items.reduce((sum, item) => sum + (item.ssr_quantity || 0), 0)}
                          </td>
                          <td className="border border-black p-2 text-right">
                            {subworkTotal.toLocaleString('hi-IN')}
                          </td>
                          <td className="border border-black p-2 text-right">
                            {subworkTotal.toLocaleString('hi-IN')}
                          </td>
                          <td className="border border-black p-2 text-right">
                            {(subworkTotal * 0.7).toLocaleString('hi-IN')}
                          </td>
                          <td className="border border-black p-2 text-right">
                            {(subworkTotal * 0.3).toLocaleString('hi-IN')}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="font-bold bg-gray-100">
                      <td colSpan={5} className="border border-black p-2 text-center">Total</td>
                      <td className="border border-black p-2 text-right">
                        {calculateTotalEstimate().toLocaleString('hi-IN')}
                      </td>
                      <td className="border border-black p-2 text-right">
                        {(calculateTotalEstimate() * 0.7).toLocaleString('hi-IN')}
                      </td>
                      <td className="border border-black p-2 text-right">
                        {(calculateTotalEstimate() * 0.3).toLocaleString('hi-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="flex justify-between mt-8">
                  <div>
                    <p className="font-medium">Prepared By -</p>
                    <p className="mt-4">{DOCUMENT_FOOTER.preparedBy}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{DOCUMENT_FOOTER.designation}</p>
                  </div>
                </div>
              </div>

              {/* Sub-work Details Pages */}
              {estimateData.subworks.map((subwork) => {
                const items = estimateData.subworkItems[subwork.subworks_id] || [];
                if (items.length === 0) return null;

                return (
                  <div key={subwork.subworks_id} className="mb-8 page-break-before">
                    <div className="text-center mb-6">
                      <h1 className="font-bold">{DOCUMENT_HEADER.zilla}</h1>
                      <h2 className="font-semibold">{DOCUMENT_HEADER.division}</h2>
                      <p>Fund Head :- {estimateData.work.fund_head || 'SBM (G.) Phase-II & 15th Finance Commission'}</p>
                      <p>Village :- Nakoda, GP :- Nakoda, Tah :- Chandrapur</p>
                      <h3 className="font-bold text-lg mt-4">Sub-work: {subwork.subworks_name}</h3>
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

                    {/* Item Details */}
                    {items.map((item) => {
                      const itemMeasurements = estimateData.measurements[item.id] || [];
                      const itemLeads = estimateData.leads[item.id] || [];
                      const itemMaterials = estimateData.materials[item.id] || [];
                      
                      const hasDetails = itemMeasurements.length > 0 || itemLeads.length > 0 || itemMaterials.length > 0;
                      
                      if (!hasDetails) return null;

                      return (
                        <div key={item.id} className="mb-6">
                          <h4 className="font-bold mb-3">Item: {item.description_of_item}</h4>
                          
                          {/* Measurements */}
                          {itemMeasurements.length > 0 && (
                            <div className="mb-4">
                              <h5 className="font-semibold mb-2">Measurements:</h5>
                              <table className="w-full border-collapse border border-black text-xs">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border border-black p-1">Sr. No</th>
                                    <th className="border border-black p-1">Description</th>
                                    <th className="border border-black p-1">No. of Units</th>
                                    <th className="border border-black p-1">Length</th>
                                    <th className="border border-black p-1">Width</th>
                                    <th className="border border-black p-1">Height</th>
                                    <th className="border border-black p-1">Quantity</th>
                                    <th className="border border-black p-1">Unit</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemMeasurements.map((measurement, idx) => (
                                    <tr key={measurement.id}>
                                      <td className="border border-black p-1 text-center">{idx + 1}</td>
                                      <td className="border border-black p-1">{measurement.description_of_items}</td>
                                      <td className="border border-black p-1 text-center">{measurement.no_of_units}</td>
                                      <td className="border border-black p-1 text-center">{measurement.length}</td>
                                      <td className="border border-black p-1 text-center">{measurement.width_breadth}</td>
                                      <td className="border border-black p-1 text-center">{measurement.height_depth}</td>
                                      <td className="border border-black p-1 text-center">{measurement.calculated_quantity}</td>
                                      <td className="border border-black p-1 text-center">{measurement.unit}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Leads */}
                          {itemLeads.length > 0 && (
                            <div className="mb-4">
                              <h5 className="font-semibold mb-2">Lead Charges:</h5>
                              <table className="w-full border-collapse border border-black text-xs">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border border-black p-1">Sr. No</th>
                                    <th className="border border-black p-1">Material</th>
                                    <th className="border border-black p-1">Location of Quarry</th>
                                    <th className="border border-black p-1">Lead (Km)</th>
                                    <th className="border border-black p-1">Lead Charges</th>
                                    <th className="border border-black p-1">Net Lead Charges</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemLeads.map((lead, idx) => (
                                    <tr key={lead.id}>
                                      <td className="border border-black p-1 text-center">{idx + 1}</td>
                                      <td className="border border-black p-1">{lead.material}</td>
                                      <td className="border border-black p-1">{lead.location_of_quarry}</td>
                                      <td className="border border-black p-1 text-center">{lead.lead_in_km}</td>
                                      <td className="border border-black p-1 text-right">{lead.lead_charges.toLocaleString('hi-IN')}</td>
                                      <td className="border border-black p-1 text-right">{lead.net_lead_charges.toLocaleString('hi-IN')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Materials */}
                          {itemMaterials.length > 0 && (
                            <div className="mb-4">
                              <h5 className="font-semibold mb-2">Materials:</h5>
                              <table className="w-full border-collapse border border-black text-xs">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="border border-black p-1">Sr. No</th>
                                    <th className="border border-black p-1">Material Name</th>
                                    <th className="border border-black p-1">Required Quantity</th>
                                    <th className="border border-black p-1">Unit</th>
                                    <th className="border border-black p-1">Rate per Unit</th>
                                    <th className="border border-black p-1">Total Cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemMaterials.map((material, idx) => (
                                    <tr key={material.id}>
                                      <td className="border border-black p-1 text-center">{idx + 1}</td>
                                      <td className="border border-black p-1">{material.material_name}</td>
                                      <td className="border border-black p-1 text-center">{material.required_quantity}</td>
                                      <td className="border border-black p-1 text-center">{material.unit}</td>
                                      <td className="border border-black p-1 text-right">{material.rate_per_unit.toLocaleString('hi-IN')}</td>
                                      <td className="border border-black p-1 text-right">{material.total_material_cost.toLocaleString('hi-IN')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div className="flex justify-between mt-8">
                      <div>
                        <p className="font-medium">Prepared By -</p>
                        <p className="mt-4">{DOCUMENT_FOOTER.preparedBy}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{DOCUMENT_FOOTER.designation}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
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
          .page-break-before {
            page-break-before: always;
          }
          .page-break-after {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
};

export default EstimatePDFGenerator;