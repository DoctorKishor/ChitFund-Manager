'use client';

import React, { useState } from 'react';
import jsPDF from 'jspdf';
import { generateQrDataUrl, getPassbookScanUrl } from '@/utils/qrCodeGenerator';
import { supabase } from '@/utils/supabase/client';
import { X, Printer, Download, Sliders, CheckCircle2, RefreshCw, FileText, QrCode } from 'lucide-react';

export interface StickerItem {
  token: string;
  name: string;
  phone?: string;
  groupName?: string;
  ticketNumber?: number;
  isBlank?: boolean;
}

interface PassbookSheetGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: StickerItem[];
  defaultTitle?: string;
  chitGroupName?: string;
}

type SizePreset = '2x2' | '2x3' | '3x3' | 'custom';

export default function PassbookSheetGeneratorModal({
  isOpen,
  onClose,
  items,
  defaultTitle = 'A4 Passbook QR Sticker Sheet Generator',
  chitGroupName,
}: PassbookSheetGeneratorModalProps) {
  const [preset, setPreset] = useState<SizePreset>('2x3');
  const [customWidthMm, setCustomWidthMm] = useState<number>(30);
  const [customHeightMm, setCustomHeightMm] = useState<number>(20);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');

  if (!isOpen) return null;

  // Compute millimeter dimensions based on preset
  let stickerWidthMm = 30;
  let stickerHeightMm = 20;

  if (preset === '2x2') {
    stickerWidthMm = 20;
    stickerHeightMm = 20;
  } else if (preset === '2x3') {
    stickerWidthMm = 30;
    stickerHeightMm = 20;
  } else if (preset === '3x3') {
    stickerWidthMm = 30;
    stickerHeightMm = 30;
  } else if (preset === 'custom') {
    stickerWidthMm = Math.max(15, customWidthMm || 30);
    stickerHeightMm = Math.max(15, customHeightMm || 20);
  }

  // A4 Page Dimensions: 210mm x 297mm
  const a4WidthMm = 210;
  const a4HeightMm = 297;
  const marginMm = 8;

  const printableWidth = a4WidthMm - marginMm * 2;
  const printableHeight = a4HeightMm - marginMm * 2;

  const colsPerPage = Math.floor(printableWidth / stickerWidthMm);
  const rowsPerPage = Math.floor(printableHeight / stickerHeightMm);
  const stickersPerPage = colsPerPage * rowsPerPage;

  const handleGeneratePdf = async (action: 'download' | 'print' = 'download') => {
    if (items.length === 0) {
      alert('No members or passbook tokens available to print.');
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationProgress('Preparing high-DPI QR codes...');

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Calculate centering offsets
      const totalGridWidth = colsPerPage * stickerWidthMm;
      const totalGridHeight = rowsPerPage * stickerHeightMm;
      const startX = marginMm + (printableWidth - totalGridWidth) / 2;
      const startY = marginMm + (printableHeight - totalGridHeight) / 2;

      let currentItemIndex = 0;
      const totalItems = items.length;

      while (currentItemIndex < totalItems) {
        if (currentItemIndex > 0) {
          doc.addPage('a4', 'portrait');
        }

        // Draw stickers on this page
        for (let row = 0; row < rowsPerPage && currentItemIndex < totalItems; row++) {
          for (let col = 0; col < colsPerPage && currentItemIndex < totalItems; col++) {
            const item = items[currentItemIndex];
            const x = startX + col * stickerWidthMm;
            const y = startY + row * stickerHeightMm;

            setGenerationProgress(
              `Rendering sticker ${currentItemIndex + 1} of ${totalItems} (${item.name})...`
            );

            // 1. Draw light cut boundary line (0.1mm dashed border)
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.15);
            doc.setLineDashPattern([1, 1], 0);
            doc.rect(x, y, stickerWidthMm, stickerHeightMm);
            doc.setLineDashPattern([], 0); // reset line dash

            // 2. Generate QR code data URL
            const scanUrl = getPassbookScanUrl(item.token);
            const qrDataUrl = await generateQrDataUrl(scanUrl, {
              width: 250,
              margin: 0,
            });

            // 3. Layout calculation based on whether sticker is Blank or Assigned
            const isBlankSticker = item.isBlank || !item.name || item.name.startsWith('BLANK PASSBOOK');

            if (isBlankSticker) {
              // PURE MINIMAL BLANK STICKER: Clean, centered, maximized QR code for easy physical scanning
              const qrSize = Math.min(stickerWidthMm - 3, stickerHeightMm - 3);
              const qrX = x + (stickerWidthMm - qrSize) / 2;
              const qrY = y + (stickerHeightMm - qrSize) / 2;
              doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
            } else if (preset === '2x2') {
              // Compact Square: QR centered, 1-line name at bottom
              const qrSize = stickerWidthMm - 4;
              doc.addImage(qrDataUrl, 'PNG', x + 2, y + 1.5, qrSize, qrSize);
              doc.setFontSize(5);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 30, 30);
              const displayName = item.name.length > 14 ? `${item.name.slice(0, 13)}.` : item.name;
              doc.text(displayName, x + stickerWidthMm / 2, y + stickerHeightMm - 1, {
                align: 'center',
              });
            } else if (preset === '3x3') {
              // Large Square: Header text, large QR, ticket tag
              doc.setFontSize(6.5);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(15, 23, 42);
              const displayName = item.name.length > 18 ? `${item.name.slice(0, 17)}.` : item.name;
              doc.text(displayName, x + stickerWidthMm / 2, y + 3.2, { align: 'center' });

              doc.setFontSize(5);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(100, 116, 139);
              if (item.phone) {
                doc.text(item.phone, x + stickerWidthMm / 2, y + 5.5, { align: 'center' });
              }

              const qrSize = 18;
              doc.addImage(qrDataUrl, 'PNG', x + (stickerWidthMm - qrSize) / 2, y + 6.5, qrSize, qrSize);

              doc.setFontSize(5.5);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(79, 70, 229);
              const ticketTag = item.ticketNumber ? `Ticket #${item.ticketNumber}` : 'MEMBER KEY';
              doc.text(ticketTag, x + stickerWidthMm / 2, y + stickerHeightMm - 1.5, { align: 'center' });
            } else {
              // Standard Rectangular (2x3cm / 30mm x 20mm) - Horizontal layout for Assigned Members
              const qrSize = 16;
              doc.addImage(qrDataUrl, 'PNG', x + 1.5, y + (stickerHeightMm - qrSize) / 2, qrSize, qrSize);

              const textX = x + qrSize + 2.5;
              doc.setFontSize(6.5);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(15, 23, 42);
              const displayName = item.name.length > 14 ? `${item.name.slice(0, 13)}.` : item.name;
              doc.text(displayName, textX, y + 5.5);

              doc.setFontSize(5);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(100, 116, 139);
              if (item.phone) {
                doc.text(item.phone, textX, y + 9);
              }

              if (item.groupName) {
                const groupShort = item.groupName.length > 12 ? `${item.groupName.slice(0, 11)}.` : item.groupName;
                doc.text(groupShort, textX, y + 12.5);
              }

              doc.setFontSize(5.5);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(79, 70, 229);
              const ticketTag = item.ticketNumber ? `Tkt #${item.ticketNumber}` : 'PASSBOOK';
              doc.text(ticketTag, textX, y + 16);
            }

            currentItemIndex++;
          }
        }
      }

      const filename = `${(chitGroupName || 'Chit_Passbook_Stickers').replace(/\s+/g, '_')}_A4_Grid.pdf`;

      if (action === 'download') {
        doc.save(filename);
      } else {
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
      }
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      alert(`Failed to generate A4 PDF: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg max-h-[90dvh] overflow-hidden shadow-2xl relative flex flex-col my-auto">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">{defaultTitle}</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {items.length} sticker{items.length !== 1 ? 's' : ''} ready for A4 grid printing
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content & Options */}
        <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1">
          {/* Dimension Presets */}
          <div>
            <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-2.5">
              Sticker Dimension Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: '2x3', name: '2 × 3 cm', desc: 'Passbook (66/pg)', rec: true },
                { id: '2x2', name: '2 × 2 cm', desc: 'Compact (96/pg)' },
                { id: '3x3', name: '3 × 3 cm', desc: 'Large (40/pg)' },
                { id: 'custom', name: 'Custom mm', desc: 'Exact input' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id as SizePreset)}
                  className={`p-3 rounded-2xl border text-left transition-all relative ${
                    preset === p.id
                      ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {p.rec && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 rounded text-[8px] font-black bg-indigo-500 text-white">
                      REC
                    </span>
                  )}
                  <p className="text-xs font-bold">{p.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Millimeter Inputs if 'custom' selected */}
          {preset === 'custom' && (
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex gap-4">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Width (mm)</label>
                <input
                  type="number"
                  min={15}
                  max={100}
                  value={customWidthMm}
                  onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Height (mm)</label>
                <input
                  type="number"
                  min={15}
                  max={100}
                  value={customHeightMm}
                  onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono"
                />
              </div>
            </div>
          )}

          {/* Sheet Preview Statistics */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs text-slate-400">
              <span>A4 Dimensions:</span>
              <span className="font-mono text-slate-200">210 mm × 297 mm</span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Grid Layout:</span>
              <span className="font-mono text-slate-200">
                {colsPerPage} cols × {rowsPerPage} rows ({stickersPerPage} per sheet)
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>Total Stickers / Pages:</span>
              <span className="font-mono text-indigo-400 font-bold">
                {items.length} stickers ({Math.ceil(items.length / (stickersPerPage || 1))} A4 page{Math.ceil(items.length / (stickersPerPage || 1)) !== 1 ? 's' : ''})
              </span>
            </div>
          </div>

          {isGenerating && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2 animate-pulse">
              <RefreshCw size={16} className="animate-spin shrink-0" />
              <span>{generationProgress || 'Generating vector PDF...'}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row justify-end gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-center"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={() => handleGeneratePdf('print')}
            disabled={isGenerating || items.length === 0}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all"
          >
            <Printer size={15} /> Preview &amp; Print
          </button>

          <button
            type="button"
            onClick={() => handleGeneratePdf('download')}
            disabled={isGenerating || items.length === 0}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/25"
          >
            <Download size={15} /> Download A4 PDF
          </button>
        </div>
      </div>
    </div>
  );
}
