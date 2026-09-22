import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';

interface ExportPdfOptions {
  container: HTMLElement;
  groupName: string;
  month: number;
  organizerName?: string;
}

export async function exportAuctionReportPdf({
  container,
  groupName,
  month,
  organizerName = "Chit Funds Manager",
}: ExportPdfOptions): Promise<void> {
  // Find all discrete semantic sections marked with .pdf-section or render entire container
  const sectionElements = Array.from(container.querySelectorAll<HTMLElement>('.pdf-section'));
  const elementsToRender = sectionElements.length > 0 ? sectionElements : [container];

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 10;
  const marginTop = 10;
  const marginBottom = 16;
  const printableWidth = pageWidth - (marginX * 2); // 190mm
  const maxPageY = pageHeight - marginBottom; // 281mm

  let currentY = marginTop;
  const gapY = 3.5; // 3.5mm clean spacing between cards

  // Render each section with high resolution
  for (let i = 0; i < elementsToRender.length; i++) {
    const el = elementsToRender[i];

    const sectionDataUrl = await toPng(el, {
      quality: 0.98,
      pixelRatio: 2, // 2x Retina resolution
      backgroundColor: '#ffffff',
      cacheBust: true,
    });

    const img = new Image();
    img.src = sectionDataUrl;
    await new Promise((resolve, reject) => {
      img.onload = () => resolve(true);
      img.onerror = reject;
    });

    const sectionHeightMm = (img.height * printableWidth) / img.width;

    // Shift to new page if exceeds printable height
    if (currentY + sectionHeightMm > maxPageY && currentY > marginTop) {
      pdf.addPage();
      currentY = marginTop;

      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184); // slate-400
      pdf.text(
        `${groupName} — Month ${month === 0 ? '0 (Launch)' : month} Auction Report (Continued)`,
        marginX,
        currentY
      );
      currentY += 5;
    }

    pdf.addImage(sectionDataUrl, 'PNG', marginX, currentY, printableWidth, sectionHeightMm, undefined, 'FAST');
    currentY += sectionHeightMm + gapY;
  }

  // Add unified footers across all pages
  const totalPages = pdf.getNumberOfPages();
  const generationDateStr =
    new Date().toLocaleDateString('en-GB') +
    ', ' +
    new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFontSize(7.5);
    pdf.setTextColor(100, 116, 139); // slate-500

    // Left: Company / Organizer Name
    pdf.text(organizerName, marginX, 290);

    // Center: Confidential / Official Audit
    pdf.text('Official Auction Audit & Timeline Record', pageWidth / 2, 290, { align: 'center' });

    // Right: Timestamp & Page
    pdf.text(`${generationDateStr} · Page ${p} of ${totalPages}`, pageWidth - marginX, 290, { align: 'right' });
  }

  const cleanOrgName = organizerName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanGroupName = (groupName || 'Group').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `${cleanGroupName}_Month_${month}_Auction_Report_${cleanOrgName}.pdf`;

  pdf.save(fileName);
}
