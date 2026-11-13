'use client';

import React, { useState, useEffect, useMemo } from 'react';
import jsPDF from 'jspdf';
import { generateQrDataUrl, getPassbookScanUrl } from '@/utils/qrCodeGenerator';
import { supabase } from '@/utils/supabase/client';
import { 
  X, 
  Printer, 
  Download, 
  Users, 
  Layers, 
  Plus, 
  RefreshCw, 
  Sparkles, 
  Trash2, 
  Calendar, 
  Sliders, 
  PackageCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { StickerItem } from './PassbookSheetGeneratorModal';

export interface PassbookQrCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  registeredSubscribers?: StickerItem[];
  defaultTab?: 'subscribers' | 'batches';
  onRefresh?: () => void;
}

interface InventoryRecord {
  id: string;
  token: string;
  batch_code: string;
  is_assigned: boolean;
  assigned_to_profile_id: string | null;
  assigned_at: string | null;
  created_at: string;
}

interface BatchSummary {
  batch_code: string;
  total: number;
  unassigned: number;
  assigned: number;
  created_at: string;
  tokens: string[];
}

type SizePreset = '2x2' | '2x3' | '3x3' | 'custom';

export default function PassbookQrCenterModal({
  isOpen,
  onClose,
  registeredSubscribers = [],
  defaultTab = 'subscribers',
  onRefresh,
}: PassbookQrCenterModalProps) {
  const [activeTab, setActiveTab] = useState<'subscribers' | 'batches'>(defaultTab);

  // Tab 1: Printable Settings & State
  const [preset, setPreset] = useState<SizePreset>('2x3');
  const [customWidthMm, setCustomWidthMm] = useState<number>(30);
  const [customHeightMm, setCustomHeightMm] = useState<number>(20);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [generationProgress, setGenerationProgress] = useState<string>('');

  // Tab 2: Inventory & Batches State
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(false);
  const [batchCount, setBatchCount] = useState<number>(66);
  const [batchCode, setBatchCode] = useState<string>('BATCH_' + new Date().getFullYear() + '_01');
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);

  // Active items to print (defaults to registeredSubscribers, or can be set to a specific batch)
  const [batchToPrint, setBatchToPrint] = useState<{ code: string; items: StickerItem[] } | null>(null);

  const fetchInventory = async () => {
    try {
      setLoadingInventory(true);
      const { data, error } = await supabase
        .from('passbook_inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInventory(data || []);
    } catch (err: any) {
      console.error('Error loading inventory:', err);
    } finally {
      setLoadingInventory(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
      setActiveTab(defaultTab);
      setBatchToPrint(null);
    }
  }, [isOpen, defaultTab]);

  // Aggregate inventory items into clean batch summaries
  const batchSummaries: BatchSummary[] = useMemo(() => {
    const map = new Map<string, BatchSummary>();

    for (const item of inventory) {
      const code = item.batch_code || 'DEFAULT_BATCH';
      if (!map.has(code)) {
        map.set(code, {
          batch_code: code,
          total: 0,
          unassigned: 0,
          assigned: 0,
          created_at: item.created_at,
          tokens: [],
        });
      }

      const batch = map.get(code)!;
      batch.total += 1;
      if (item.is_assigned) {
        batch.assigned += 1;
      } else {
        batch.unassigned += 1;
        batch.tokens.push(item.token);
      }
    }

    return Array.from(map.values());
  }, [inventory]);

  if (!isOpen) return null;

  const totalPool = inventory.length;
  const unassignedCount = inventory.filter((i) => !i.is_assigned).length;
  const assignedCount = inventory.filter((i) => i.is_assigned).length;

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

  // Determine active print items based on tab or selected batch
  const activePrintItems: StickerItem[] = batchToPrint 
    ? batchToPrint.items 
    : registeredSubscribers;

  const totalPages = Math.ceil((activePrintItems.length || 1) / (stickersPerPage || 1));

  // PDF Generator for either Subscribers or Blank Batches
  const handleGeneratePdf = async (action: 'download' | 'print' = 'download', itemsToPrint: StickerItem[] = activePrintItems) => {
    if (itemsToPrint.length === 0) {
      alert('No stickers available to print.');
      return;
    }

    try {
      setIsGeneratingPdf(true);
      setGenerationProgress('Generating high-resolution QR codes...');

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const totalGridWidth = colsPerPage * stickerWidthMm;
      const totalGridHeight = rowsPerPage * stickerHeightMm;
      const startX = marginMm + (printableWidth - totalGridWidth) / 2;
      const startY = marginMm + (printableHeight - totalGridHeight) / 2;

      let currentItemIndex = 0;
      const totalItems = itemsToPrint.length;

      while (currentItemIndex < totalItems) {
        if (currentItemIndex > 0) {
          doc.addPage('a4', 'portrait');
        }

        for (let row = 0; row < rowsPerPage && currentItemIndex < totalItems; row++) {
          for (let col = 0; col < colsPerPage && currentItemIndex < totalItems; col++) {
            const item = itemsToPrint[currentItemIndex];
            const x = startX + col * stickerWidthMm;
            const y = startY + row * stickerHeightMm;

            setGenerationProgress(
              `Rendering sticker ${currentItemIndex + 1} of ${totalItems}...`
            );

            // 1. Draw light cut boundary line (0.1mm dashed border)
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.15);
            doc.setLineDashPattern([1, 1], 0);
            doc.rect(x, y, stickerWidthMm, stickerHeightMm);
            doc.setLineDashPattern([], 0);

            // 2. Generate QR code data URL
            const scanUrl = getPassbookScanUrl(item.token);
            const qrDataUrl = await generateQrDataUrl(scanUrl, {
              width: 250,
              margin: 0,
            });

            // 3. Layout calculation: Clean centered for Blank vs Detail for Member
            const isBlankSticker = item.isBlank || !item.name || item.name.startsWith('BLANK');

            if (isBlankSticker) {
              // PURE MINIMAL BLANK STICKER: Clean, centered, maximized QR code
              const qrSize = Math.min(stickerWidthMm - 3, stickerHeightMm - 3);
              const qrX = x + (stickerWidthMm - qrSize) / 2;
              const qrY = y + (stickerHeightMm - qrSize) / 2;
              doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
            } else if (preset === '2x2') {
              const qrSize = stickerWidthMm - 4;
              doc.addImage(qrDataUrl, 'PNG', x + 2, y + 1.5, qrSize, qrSize);
              doc.setFontSize(5);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(30, 30, 30);
              const displayName = item.name.length > 14 ? `${item.name.slice(0, 13)}.` : item.name;
              doc.text(displayName, x + stickerWidthMm / 2, y + stickerHeightMm - 1, { align: 'center' });
            } else if (preset === '3x3') {
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

      const filename = batchToPrint 
        ? `Blank_Passbook_${batchToPrint.code}_A4_Grid.pdf`
        : `All_Subscribers_Passbook_Stickers_A4.pdf`;

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
      setIsGeneratingPdf(false);
      setGenerationProgress('');
    }
  };

  // Create Batch
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGeneratingBatch) return;

    try {
      setIsGeneratingBatch(true);
      const { data, error } = await supabase.rpc('generate_blank_passbook_batch', {
        p_count: Number(batchCount),
        p_batch_code: batchCode.trim() || 'BATCH_001',
      });

      if (error) throw error;
      if (!data || !data.success) throw new Error(data?.error || 'Failed to generate batch');

      await fetchInventory();
      if (onRefresh) onRefresh();

      // Offer immediate print
      const newItems: StickerItem[] = (data.tokens as string[]).map((t) => ({
        token: t,
        name: '',
        groupName: batchCode.trim(),
        isBlank: true,
      }));

      setBatchToPrint({ code: batchCode.trim(), items: newItems });
    } catch (err: any) {
      alert(`Batch generation failed: ${err.message}`);
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Delete Batch
  const handleDeleteBatch = async (batch: BatchSummary) => {
    if (batch.unassigned === 0) {
      alert(`All stickers in "${batch.batch_code}" are paired to active members and cannot be deleted.`);
      return;
    }

    const confirmMsg = batch.assigned > 0
      ? `Delete ${batch.unassigned} unassigned QR stickers from batch "${batch.batch_code}"?\n\nNote: ${batch.assigned} already-paired member passbooks will be safely preserved.`
      : `Delete all ${batch.total} unassigned QR stickers in batch "${batch.batch_code}"?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setDeletingBatch(batch.batch_code);
      const { error } = await supabase
        .from('passbook_inventory')
        .delete()
        .eq('batch_code', batch.batch_code)
        .eq('is_assigned', false);

      if (error) throw error;
      await fetchInventory();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Failed to delete batch: ${err.message}`);
    } finally {
      setDeletingBatch(null);
    }
  };

  // Delete All Unassigned
  const handleDeleteAllUnassigned = async () => {
    if (unassignedCount === 0) {
      alert('No unassigned QR codes to delete.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ALL ${unassignedCount} unassigned blank QR codes across all batches?\n\nAll already-paired member books will remain safe.`)) {
      return;
    }

    try {
      setLoadingInventory(true);
      const { error } = await supabase
        .from('passbook_inventory')
        .delete()
        .eq('is_assigned', false);

      if (error) throw error;
      await fetchInventory();
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(`Failed to delete unassigned QR codes: ${err.message}`);
    } finally {
      setLoadingInventory(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 font-sans overflow-y-auto">
      <div className="bg-white border border-slate-200/90 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90dvh] my-auto text-slate-900">
        
        {/* Header with Navigation Tabs */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 shrink-0">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                Passbook QR Center
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 truncate">
                Print subscriber passbook stickers &amp; manage blank batch inventory
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 pb-0 bg-slate-50/80 border-b border-slate-200/80 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('subscribers');
              setBatchToPrint(null);
            }}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'subscribers' && !batchToPrint
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users size={14} className={activeTab === 'subscribers' && !batchToPrint ? 'text-brand-600' : ''} />
            <span>Registered Subscribers ({registeredSubscribers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batches')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'batches' || batchToPrint
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers size={14} className={activeTab === 'batches' || batchToPrint ? 'text-brand-600' : ''} />
            <span>Blank Stock Batches ({batchSummaries.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4 bg-white">
          
          {/* ══════════════ TAB 1: REGISTERED SUBSCRIBERS ══════════════ */}
          {activeTab === 'subscribers' && !batchToPrint && (
            <div className="space-y-4">
              
              {/* Preset Selector */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Sticker Dimension Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreset('2x3')}
                    className={`p-3 rounded-2xl border text-left transition-all relative cursor-pointer ${
                      preset === '2x3'
                        ? 'bg-brand-50/80 border-brand-500 text-slate-900 shadow-xs ring-1 ring-brand-500/30'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-[10px] absolute top-2 right-2 px-1.5 py-0.5 rounded bg-brand-600 text-white font-bold">
                      REC
                    </span>
                    <div className="text-xs font-bold text-slate-900">2 × 3 cm</div>
                    <div className="text-[10px] text-slate-500">Passbook (66/pg)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreset('2x2')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      preset === '2x2'
                        ? 'bg-brand-50/80 border-brand-500 text-slate-900 shadow-xs ring-1 ring-brand-500/30'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">2 × 2 cm</div>
                    <div className="text-[10px] text-slate-500">Compact (96/pg)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreset('3x3')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      preset === '3x3'
                        ? 'bg-brand-50/80 border-brand-500 text-slate-900 shadow-xs ring-1 ring-brand-500/30'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">3 × 3 cm</div>
                    <div className="text-[10px] text-slate-500">Large (40/pg)</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreset('custom')}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      preset === 'custom'
                        ? 'bg-brand-50/80 border-brand-500 text-slate-900 shadow-xs ring-1 ring-brand-500/30'
                        : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">Custom mm</div>
                    <div className="text-[10px] text-slate-500">Exact input</div>
                  </button>
                </div>
              </div>

              {/* Custom Dimensions Form */}
              {preset === 'custom' && (
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200 grid grid-cols-2 gap-3 animate-in fade-in duration-200">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Sticker Width (mm)
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={150}
                      value={customWidthMm}
                      onChange={(e) => setCustomWidthMm(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                      Sticker Height (mm)
                    </label>
                    <input
                      type="number"
                      min={15}
                      max={150}
                      value={customHeightMm}
                      onChange={(e) => setCustomHeightMm(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
                    />
                  </div>
                </div>
              )}

              {/* Page Layout Spec Box */}
              <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>A4 Dimensions:</span>
                  <span className="font-mono text-slate-900 font-medium">210 mm × 297 mm</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Grid Layout:</span>
                  <span className="font-mono text-slate-900 font-medium">
                    {colsPerPage} cols × {rowsPerPage} rows ({stickersPerPage} per sheet)
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200/80 pt-2">
                  <span>Total Stickers / Pages:</span>
                  <span className="text-brand-600">
                    {registeredSubscribers.length} stickers ({totalPages} A4 page{totalPages !== 1 ? 's' : ''})
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleGeneratePdf('print')}
                  disabled={isGeneratingPdf || registeredSubscribers.length === 0}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-all border border-slate-200 shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Printer size={15} />
                  <span>Preview &amp; Print</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGeneratePdf('download')}
                  disabled={isGeneratingPdf || registeredSubscribers.length === 0}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm shadow-brand-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingPdf ? <RefreshCw className="animate-spin" size={15} /> : <Download size={15} />}
                  <span>{isGeneratingPdf ? generationProgress || 'Generating...' : 'Download A4 PDF'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ══════════════ TAB 2: BLANK STOCK BATCHES ══════════════ */}
          {(activeTab === 'batches' || batchToPrint) && (
            <div className="space-y-4">
              
              {/* If specific batch print is active */}
              {batchToPrint ? (
                <div className="p-4 rounded-2xl bg-brand-50/70 border border-brand-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">
                        Print Batch: {batchToPrint.code}
                      </h4>
                      <p className="text-xs text-slate-600">
                        {batchToPrint.items.length} unassigned blank stickers ready for A4 sheet printing
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBatchToPrint(null)}
                      className="text-xs text-brand-600 hover:text-brand-800 font-semibold cursor-pointer"
                    >
                      Back to Batches
                    </button>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleGeneratePdf('print', batchToPrint.items)}
                      disabled={isGeneratingPdf}
                      className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Printer size={14} /> Preview &amp; Print
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGeneratePdf('download', batchToPrint.items)}
                      disabled={isGeneratingPdf}
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm shadow-brand-600/30 cursor-pointer"
                    >
                      {isGeneratingPdf ? <RefreshCw className="animate-spin" size={14} /> : <Download size={14} />}
                      <span>Download A4 PDF</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Stats Bar */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Pool</span>
                      <span className="text-xl font-black text-slate-900">{totalPool}</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/80">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Available (Ready)</span>
                      <span className="text-xl font-black text-emerald-700">{unassignedCount}</span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-200/80">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Paired to Books</span>
                      <span className="text-xl font-black text-indigo-700">{assignedCount}</span>
                    </div>
                  </div>

                  {/* Batch Generator Form */}
                  <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200">
                    <form onSubmit={handleCreateBatch} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Sparkles size={14} className="text-brand-600" /> Generate New Blank QR Batch
                        </span>
                        <span className="text-[11px] text-slate-500">66 stickers = Exactly 1 full A4 sheet</span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                          <input
                            type="text"
                            required
                            placeholder="Batch Code (e.g. BATCH_2026_01)"
                            value={batchCode}
                            onChange={(e) => setBatchCode(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 font-mono shadow-xs"
                          />
                        </div>
                        <div className="w-full sm:w-32">
                          <input
                            type="number"
                            min={1}
                            max={500}
                            required
                            value={batchCount}
                            onChange={(e) => setBatchCount(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 shadow-xs"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isGeneratingBatch}
                          className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm shadow-brand-600/30 shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isGeneratingBatch ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                          <span>Generate Batch</span>
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Batches List */}
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Batches ({batchSummaries.length})
                      </span>
                      {unassignedCount > 0 && (
                        <button
                          type="button"
                          onClick={handleDeleteAllUnassigned}
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} /> Clear All Unassigned ({unassignedCount})
                        </button>
                      )}
                    </div>

                    {loadingInventory ? (
                      <div className="py-10 flex justify-center items-center text-slate-500 text-xs">
                        <RefreshCw size={18} className="animate-spin mr-2 text-brand-600" /> Loading batches...
                      </div>
                    ) : batchSummaries.length === 0 ? (
                      <div className="py-8 text-center text-slate-500 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                        No passbook batches generated yet. Generate a batch above to create blank stock.
                      </div>
                    ) : (
                      batchSummaries.map((batch) => (
                        <div
                          key={batch.batch_code}
                          className="p-3.5 rounded-2xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-brand-300 transition-colors shadow-xs"
                        >
                          <div className="flex items-start sm:items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600 shrink-0">
                              <PackageCheck size={18} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-900">
                                  {batch.batch_code}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-medium">
                                  {batch.total} Total
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                                <span className="text-emerald-600 font-semibold">{batch.unassigned} Ready</span>
                                <span>•</span>
                                <span className="text-indigo-600 font-semibold">{batch.assigned} Paired</span>
                                <span>•</span>
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Calendar size={11} /> {new Date(batch.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                const items: StickerItem[] = batch.tokens.map((t) => ({
                                  token: t,
                                  name: '',
                                  groupName: batch.batch_code,
                                  isBlank: true,
                                }));
                                setBatchToPrint({ code: batch.batch_code, items });
                              }}
                              disabled={batch.unassigned === 0}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                batch.unassigned > 0
                                  ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-xs'
                                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                              }`}
                            >
                              <Printer size={13} />
                              <span>Print Sheet ({batch.unassigned})</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteBatch(batch)}
                              disabled={deletingBatch === batch.batch_code || batch.unassigned === 0}
                              title={batch.unassigned === 0 ? 'All stickers in this batch are paired' : 'Delete unassigned QR codes'}
                              className={`p-2 rounded-xl text-xs transition-colors cursor-pointer ${
                                batch.unassigned > 0
                                  ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200'
                                  : 'text-slate-300 border border-slate-200 cursor-not-allowed'
                              }`}
                            >
                              {deletingBatch === batch.batch_code ? (
                                <RefreshCw size={14} className="animate-spin" />
                              ) : (
                                <Trash2 size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 shadow-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
