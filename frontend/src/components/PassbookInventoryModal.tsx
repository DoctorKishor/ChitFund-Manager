'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { X, Layers, Plus, Printer, RefreshCw, CheckCircle2, QrCode, Sparkles, AlertCircle, FileText } from 'lucide-react';
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
      const newItems: StickerItem[] = (data.tokens as string[]).map((t, idx) => ({
        token: t,
        name: `BLANK PASSBOOK #${idx + 1}`,
        groupName: batchCode.trim(),
      }));

      setPrintItems(newItems);
      setIsPrintModalOpen(true);
    } catch (err: any) {
      alert(`Batch generation failed: ${err.message}`);
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  const handlePrintUnassigned = () => {
    const unassigned = inventory.filter((i) => !i.is_assigned);
    if (unassigned.length === 0) {
      alert('No unassigned blank stickers available. Generate a new batch first.');
      return;
    }

    const items: StickerItem[] = unassigned.map((u, idx) => ({
      token: u.token,
      name: `BLANK PASSBOOK #${idx + 1}`,
      groupName: u.batch_code,
    }));

    setPrintItems(items);
    setIsPrintModalOpen(true);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <Layers size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  Blank Passbook QR Inventory
                </h3>
                <p className="text-xs text-slate-400">
                  Pre-print QR stickers in bulk & pair physical books on the spot
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
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
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Unassigned (Ready)</span>
              <span className="text-xl font-black text-emerald-400">{unassignedCount}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-900 border border-indigo-500/30">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Paired to Members</span>
              <span className="text-xl font-black text-indigo-400">{assignedCount}</span>
            </div>
          </div>

          {/* Batch Generator Form */}
          <div className="p-5 border-b border-slate-800 bg-indigo-950/20">
            <form onSubmit={handleCreateBatch} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-indigo-400" /> Generate New Blank QR Batch
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500"
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
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGeneratingBatch}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 shrink-0"
                >
                  {isGeneratingBatch ? <RefreshCw className="animate-spin" size={14} /> : <Plus size={14} />}
                  Generate Batch
                </button>
              </div>
            </form>
          </div>

          {/* Table / List */}
          <div className="p-5 overflow-y-auto flex-1 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Inventory Tokens ({inventory.length})
              </span>
              <button
                type="button"
                onClick={handlePrintUnassigned}
                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <Printer size={13} /> Print Unassigned ({unassignedCount})
              </button>
            </div>

            {loading ? (
              <div className="py-12 flex justify-center items-center text-slate-500 text-xs">
                <RefreshCw size={20} className="animate-spin mr-2" /> Loading inventory...
              </div>
            ) : inventory.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs bg-slate-950/40 rounded-2xl border border-slate-800">
                No passbook tokens in inventory. Generate your first blank batch above!
              </div>
            ) : (
              <div className="space-y-1.5">
                {inventory.slice(0, 50).map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <QrCode size={16} className="text-slate-500" />
                      <div>
                        <span className="font-mono text-[11px] text-slate-300">{item.token}</span>
                        <div className="text-[10px] text-slate-500">{item.batch_code}</div>
                      </div>
                    </div>
                    <div>
                      {item.is_assigned ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Paired
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Blank Ready
                        </span>
                      )}
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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
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
