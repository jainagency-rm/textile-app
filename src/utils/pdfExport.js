export async function exportOrderPDF(order) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const navy = [3, 22, 50], gray = [100, 116, 139], lightGray = [241, 245, 249], W = 210, margin = 16;
  
  pdf.setFillColor(...navy); pdf.rect(0, 0, W, 38, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(18); pdf.setFont('helvetica', 'bold');
  pdf.text('JAIN AGENCY', margin, 15);
  pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(200, 200, 200);
  pdf.text('Supplier Order Receipt', margin, 22);
  pdf.setFontSize(11); pdf.setTextColor(255, 255, 255);
  pdf.text(`Order #${order.id.slice(0, 8).toUpperCase()}`, W - margin, 15, { align: 'right' });
  pdf.setFontSize(9); pdf.setTextColor(200, 200, 200);
  pdf.text(order.createdAt?.toDate?.()?.toLocaleDateString('en-IN') || '', W - margin, 22, { align: 'right' });
  
  let y = 46;
  pdf.setFillColor(...lightGray); pdf.roundedRect(margin, y, W - margin * 2, 22, 3, 3, 'F');
  pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...navy);
  pdf.text('Buyer:', margin + 4, y + 8); pdf.setFont('helvetica', 'normal');
  pdf.text(order.buyerFirm || '—', margin + 18, y + 8);
  pdf.setFont('helvetica', 'bold'); pdf.text('Status:', margin + 4, y + 17);
  pdf.setFont('helvetica', 'normal'); pdf.text(order.status || 'Pending', margin + 20, y + 17);
  
  y += 30;
  pdf.setTextColor(...navy); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
  pdf.text('ORDER ITEMS', margin, y); y += 6;
  pdf.setFillColor(...navy); pdf.rect(margin, y, W - margin * 2, 8, 'F');
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
  pdf.text('Product', margin + 3, y + 5.5); pdf.text('Design/Size', margin + 85, y + 5.5);
  pdf.text('Ordered', margin + 130, y + 5.5); pdf.text('Dispatched', margin + 155, y + 5.5);
  pdf.text('Unit', margin + 178, y + 5.5); y += 8;
  
  (order.items || []).forEach((item, idx) => {
    if (idx % 2 === 0) { pdf.setFillColor(248, 250, 252); pdf.rect(margin, y, W - margin * 2, 7, 'F'); }
    pdf.setTextColor(...navy); pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.text((item.productName || '').slice(0, 32), margin + 3, y + 5);
    const ds = item.designNo ? `DN${item.designNo}` : item.size ? `Sz ${item.size}` : '—';
    pdf.text(ds, margin + 85, y + 5);
    pdf.text(String(item.orderedQty || item.quantity || item.sets || 0), margin + 130, y + 5);
    pdf.setTextColor(22, 163, 74); pdf.text(String(item.dispatchedQty || 0), margin + 155, y + 5);
    pdf.setTextColor(...gray); pdf.text(item.unit || 'Piece', margin + 178, y + 5); y += 7;
  });
  
  if (order.nightyDetails) {
    y += 3; pdf.setTextColor(...gray); pdf.setFontSize(8);
    pdf.text(`Packing: ${order.nightyDetails.totalSets} sets · ${order.nightyDetails.packingType}/bale · ${order.nightyDetails.totalBales} bales`, margin, y); y += 6;
  }
  
  const shipments = order.shipments || [];
  if (shipments.length > 0) {
    y += 6; pdf.setTextColor(...navy); pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
    pdf.text('DISPATCH HISTORY', margin, y); y += 6;
    shipments.forEach((ship, idx) => {
      if (y > 250) { pdf.addPage(); y = 20; }
      pdf.setFillColor(...lightGray); pdf.roundedRect(margin, y, W - margin * 2, 9, 2, 2, 'F');
      pdf.setFillColor(...navy); pdf.roundedRect(margin, y, 3, 9, 1, 1, 'F');
      pdf.setTextColor(...navy); pdf.setFontSize(9); pdf.setFont('helvetica', 'bold');
      pdf.text(`Dispatch ${idx + 1}${ship.billDate ? ` (${ship.billDate})` : ''}`, margin + 6, y + 6.5); y += 9;
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...gray);
      const det = [ship.billNo && `Bill: ${ship.billNo}`, ship.transport && `Transport: ${ship.transport}`, ship.lrNo && `LR: ${ship.lrNo}`].filter(Boolean).join('   ');
      pdf.text(det, margin + 4, y + 5); y += 8;
      (ship.items || []).forEach(i => { pdf.setTextColor(...navy); pdf.setFontSize(8); pdf.text(`• ${i.productName}${i.size ? ` (${i.size})` : ''}: ${i.qty} ${i.unit || ''}`, margin + 6, y + 4); y += 6; });
      y += 2;
    });
  }
  
  y = 285; pdf.setFillColor(...navy); pdf.rect(0, y, W, 12, 'F');
  pdf.setTextColor(200, 200, 200); pdf.setFontSize(8);
  pdf.text('Jain Agency — Supplier Copy', margin, y + 8);
  pdf.text('Page 1', W - margin, y + 8, { align: 'right' });
  pdf.save(`Order_${order.id.slice(0, 8)}.pdf`);
}