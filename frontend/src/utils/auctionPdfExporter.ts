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
  // Create an offscreen, fixed-width clone of the printable container
  // This guarantees zero scrollbars, zero text truncation, and pixel-perfect print layout regardless of screen/modal size
  const offscreenContainer = document.createElement('div');
  offscreenContainer.style.position = 'fixed';
  offscreenContainer.style.top = '0';
  offscreenContainer.style.left = '-9999px';
  offscreenContainer.style.width = '794px'; // Standard A4 pixel width at 96 DPI
  offscreenContainer.style.maxWidth = '794px';
  offscreenContainer.style.minWidth = '794px';
  offscreenContainer.style.backgroundColor = '#ffffff';
  offscreenContainer.style.zIndex = '-9999';
  offscreenContainer.style.overflow = 'visible';

  const clone = container.cloneNode(true) as HTMLElement;
  clone.style.width = '100%';
  clone.style.maxWidth = 'none';
  clone.style.overflow = 'visible';

  // Remove any responsive scroll containers or clipping styles in the clone
  const scrollableElements = clone.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto, [class*="overflow-"]');
  scrollableElements.forEach((el) => {
    el.style.overflow = 'visible';
    el.style.maxWidth = 'none';
    el.style.width = '100%';
  });

  // Ensure all tables in the clone span 100% without minimum-width overflow
  const tables = clone.querySelectorAll<HTMLTableElement>('table');
  tables.forEach((table) => {
    table.style.width = '100%';
    table.style.minWidth = '100%';
    table.style.tableLayout = 'auto';
  });

  offscreenContainer.appendChild(clone);
  document.body.appendChild(offscreenContainer);

  try {
    // Wait a brief tick for fonts/layout to settle
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Find all discrete semantic sections marked with .pdf-section or render entire clone
    const sectionElements = Array.from(clone.querySelectorAll<HTMLElement>('.pdf-section'));
    const elementsToRender = sectionElements.length > 0 ? sectionElements : [clone];

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
        pixelRatio: 2.5, // Crisp high-DPI rendering
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
  } finally {
    // Clean up offscreen container
    if (document.body.contains(offscreenContainer)) {
      document.body.removeChild(offscreenContainer);
    }
  }
}
