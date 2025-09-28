ssName="border border-black p-1" style={{ border: '1px solid black', padding: '4px' }}></td>
                                      <td className="border border-black p-1" style={{ border: '1px solid black', padding: '4px' }}></td>
                                      <td className="border border-black p-1" style={{ border: '1px solid black', padding: '4px' }}></td>
                                      <td className="border border-black p-1" style={{ border: '1px solid black', padding: '4px' }}></td>
                                      <td className="border border-black p-1" style={{ border: '1px solid black', padding: '4px' }}></td>
                                    </tr>
                                </th>
                                    {/* Measurement Data Rows */}
                                    {itemMeasurements.map((measurement, measurementIndex) => (
                                      <tr key={measurementIndex} className="hover:bg-blue-50 transition-colors">
                                        <td className="border border-black p-2 text-right pr-4 text-gray-700" style={{ border: '1px solid black', padding: '4px', textAlign: 'right', paddingRight: '8px' }}>
                                          {measurement.description_of_items || ''}
                                        </td>
                                        <td className="border border-black p-2 text-center font-medium text-blue-600" style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: '500' }}>
                                          {measurement.no_of_units || 1}
                                        </td>
                                        <td className="border border-black p-2 text-center font-medium text-blue-600" style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: '500' }}>
                                          {(measurement.length || 0).toFixed(2)}
                                        </td>
                                        <td className="border border-black p-2 text-center font-medium text-blue-600" style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: '500' }}>
                                          {(measurement.width_breadth || 0).toFixed(2)}
                                        </td>
                                        <td className="border border-black p-2 text-center font-medium text-blue-600" style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: '500' }}>
                                          {(measurement.height_depth || 0).toFixed(2)}
                                        </td>
                                        <td className="border border-black p-2 text-center font-bold text-green-600" style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>
                                          {(measurement.calculated_quantity || 0).toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                <th className="border border-black p-3 text-center font-bold" style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', width: '13%' }}>
                                    {/* Total Row for Item */}
                                    <tr className="bg-gradient-to-r from-green-50 to-emerald-100">
                                      <td className="border border-black p-2 text-right font-bold pr-4" style={{ border: '1px solid black', padding: '4px', textAlign: 'right', paddingRight: '8px', fontWeight: 'bold' }}>
                                        Total
                                      </td>
                                      <td className="border border-black p-1" style={{ border: '1px solid black', padding: '4px' }}></td>
                                      <td className="border border-black p-1" style={{ border: '1px solid black', padding: '4px' }}></td>
                                      <td className="border border-black p-1" style={{ border: '1px solid black', padding: '4px' }}></td>
                                      <td className="border border-black p-1" style={{ border: '1px solid black', padding: '4px' }}></td>
                                      <td className="border border-black p-2 text-center font-bold text-green-700 bg-green-100" style={{ border: '1px solid black', padding: '4px', textAlign: 'center', fontWeight: 'bold', backgroundColor: '#dcfce7' }}>
                                        {itemMeasurements.reduce((sum, m) => sum + (m.calculated_quantity || 0), 0).toFixed(2)}
                                      </td>
                                    </tr>
                                  Qty.
                                    {/* Spacing row between items */}
                                    {itemIndex < itemsWithMeasurements.length - 1 && (
                                      <tr style={{ height: '8px' }}>
                                        <td className="border border-black" style={{ border: '1px solid black', height: '8px' }} colSpan={6}></td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                                </th>
                              {/* Add empty rows for manual entries */}
                              {Array.from({ length: 6 }, (_, index) => (
                                <tr key={`empty-${index}`} style={{ height: '18px' }}>
                                  <td className="border border-black" style={{ border: '1px solid black', height: '18px' }}></td>
                                  <td className="border border-black" style={{ border: '1px solid black' }}></td>
                                  <td className="border border-black" style={{ border: '1px solid black' }}></td>
                                  <td className="border border-black" style={{ border: '1px solid black' }}></td>
                                  <td className="border border-black" style={{ border: '1px solid black' }}></td>
                                  <td className="border border-black" style={{ border: '1px solid black' }}></td>
                                </tr>
                              ))}
                            </tbody>
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
                          </table>
                        </div>
                      </div>
                      
                      <PageFooter pageNumber={4 + subworkIndex} />
                    </div>
                  );
                })}
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