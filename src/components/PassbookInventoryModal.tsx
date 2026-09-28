'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/utils/supabase/client';
import { 
  X, 
  Layers, 
  Plus, 
  Printer, 
  RefreshCw, 
  Sparkles, 
  Trash2, 
  Calendar,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';
import PassbookSheetGeneratorModal, { StickerItem } from './PassbookSheetGeneratorModal';

interface PassbookInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  tokens: string[]; // unassigned tokens
}

export default function PassbookInventoryModal({
  isOpen,
  onClose,
  onRefresh,
}: PassbookInventoryModalProps) {
  const [inventory, setInventory] = useState<InventoryRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [batchCount, setBatchCount] = useState<number>(66);
  const [batchCode, setBatchCode] = useState<string>('BATCH_' + new Date().getFullYear() + '_01');
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printItems, setPrintItems] = useState<StickerItem[]>([]);
  const [deletingBatch, setDeletingBatch] = useState<string | null>(null);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('passbook_inventory')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInventory(data || []);
    } catch (err: any) {
      console.error('Error loading passbook inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchInventory();
    }
  }, [isOpen]);

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

  const totalCount = inventory.length;
  const unassignedCount = inventory.filter((i) => !i.is_assigned).length;
  const assignedCount = inventory.filter((i) => i.is_assigned).length;

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

      setPrintItems(newItems);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      alert(`Batch generation failed: ${err.message}`);
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const handlePrintBatch = (batch: BatchSummary) => {
    if (batch.tokens.length === 0) {
      alert(`All stickers in batch "${batch.batch_code}" have already been assigned to members.`);
      return;
    }

    const items: StickerItem[] = batch.tokens.map((t) => ({
      token: t,
      name: '',
      groupName: batch.batch_code,
      isBlank: true,
    }));

    setPrintItems(items);
    setIsPrintModalOpen(true);
  };

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

  const handleDeleteAllUnassigned = async () => {
    if (unassignedCount === 0) {
      alert('No unassigned QR codes to delete.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ALL ${unassignedCount} unassigned blank QR codes across all batches?\n\nAll already-paired member books will remain safe.`)) {
      return;
    }

    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200 font-sans overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90dvh] my-auto">
          
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                <Layers size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  Blank Passbook QR Batches
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  Generate A4 sticker sheets in bulk &amp; manage inventory batches
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

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 p-5 bg-slate-950/50 border-b border-slate-800">
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Pool</span>
              <span className="text-xl font-black text-white">{totalCount}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-emerald-500/30">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Available (Ready)</span>
              <span className="text-xl font-black text-emerald-400">{unassignedCount}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-indigo-500/30">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Paired to Books</span>
              <span className="text-xl font-black text-indigo-400">{assignedCount}</span>
            </div>
          </div>

          {/* Batch Generator Form */}
          <div className="p-5 border-b border-slate-800 bg-indigo-950/20">
            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-400" /> Generate New Batch
                </span>
                <span className="text-[11px] text-slate-400">66 stickers = Exactly 1 full A4 sheet</span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    required
                    placeholder="Batch Code (e.g. BATCH_2026_01)"
                    value={batchCode}
                    onChange={(e) => setBatchCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGeneratingBatch}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 shrink-0"
                >
                  {isGeneratingBatch ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                  <span>Generate Batch</span>
                </button>
              </div>
            </form>
          </div>

          {/* Batches List */}
          <div className="p-5 overflow-y-auto flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Batches ({batchSummaries.length})
              </span>
              {unassignedCount > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteAllUnassigned}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={13} /> Clear All Unassigned ({unassignedCount})
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-12 flex justify-center items-center text-slate-500 text-xs">
                <RefreshCw size={20} className="animate-spin mr-2" /> Loading batches...
              </div>
            ) : batchSummaries.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
                No passbook batches generated yet. Use the form above to generate your first batch!
              </div>
            ) : (
              <div className="space-y-2.5">
                {batchSummaries.map((batch) => (
                  <div
                    key={batch.batch_code}
                    className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start sm:items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        <PackageCheck size={18} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {batch.batch_code}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 font-medium">
                            {batch.total} Total Stickers
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span className="text-emerald-400 font-semibold">{batch.unassigned} Ready</span>
                          <span>•</span>
                          <span className="text-indigo-400">{batch.assigned} Paired</span>
                          <span>•</span>
                          <span className="text-slate-500 flex items-center gap-1">
                            <Calendar size={11} /> {new Date(batch.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => handlePrintBatch(batch)}
                        disabled={batch.unassigned === 0}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                          batch.unassigned > 0
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                            : 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
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
                        className={`p-2 rounded-xl text-xs transition-colors ${
                          batch.unassigned > 0
                            ? 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20'
                            : 'text-slate-700 border border-slate-800/60 cursor-not-allowed'
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
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Embedded A4 PDF Sheet Exporter */}
      <PassbookSheetGeneratorModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        items={printItems}
        defaultTitle="Blank QR Passbook Sticker Sheet"
        chitGroupName="Blank_Passbook_Batch"
      />
    </>
  );
}
