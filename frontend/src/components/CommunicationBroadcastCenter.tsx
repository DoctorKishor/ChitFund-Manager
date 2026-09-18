'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { 
  Send, 
  Copy, 
  Check, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  Info,
  Calendar,
  Layers,
  FileText,
  Clock
} from 'lucide-react';

interface GroupMetadata {
  id: string;
  name: string;
  currentMonth: number;
  poolValue: number;
  auctionDate: string;
  winnerName: string;
  winningDiscount: number;
  netPayout: number;
  dividend: number;
  fixedInstallment: number;
}

interface CommunicationBroadcastCenterProps {
  onAddAuditLog?: (desc: string) => void;
}

export default function CommunicationBroadcastCenter({ onAddAuditLog }: CommunicationBroadcastCenterProps) {
  const { profile } = useAuth();
  const [groupsMetadata, setGroupsMetadata] = useState<Record<string, GroupMetadata>>({});
  const [activeGroupKey, setActiveGroupKey] = useState<string>('');
  const [templateType, setTemplateType] = useState<'pre-auction' | 'post-auction'>('pre-auction');
  const [copied, setCopied] = useState<boolean>(false);
  const [broadcastText, setBroadcastText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  
  // Custom Dynamic Signature Line
  const [signatureLine, setSignatureLine] = useState<string>(
    profile?.fullName ? `${profile.fullName}'s Chit Fund Organization` : 'Chit Fund Organization'
  );

  useEffect(() => {
    if (profile?.fullName) {
      setSignatureLine(`${profile.fullName}'s Chit Fund Organization`);
    }
  }, [profile]);

  // Fetch active chit groups for broadcast center
  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data: groupsData } = await supabase
        .from('chit_groups')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (groupsData && groupsData.length > 0) {
        const metaMap: Record<string, GroupMetadata> = {};
        
        // Also fetch latest auction logs for winner details if post-auction
        const { data: logsData } = await supabase
          .from('auction_logs')
          .select('*')
          .order('month', { ascending: false });

        groupsData.forEach((g: any) => {
          const installment = Math.floor(Number(g.total_value) / (g.duration_months || 1));
          const currentM = (g.current_month !== undefined && g.current_month !== null) ? Number(g.current_month) : 0;
          const groupLogs = (logsData || []).filter((l: any) => l.group_id === g.id && Number(l.month) === currentM);
          const latestLog = groupLogs[0];

          metaMap[g.id] = {
            id: g.id,
            name: g.name,
            currentMonth: currentM,
            poolValue: Number(g.total_value),
            auctionDate: 'First Sunday after 10th',
            winnerName: latestLog?.winner_name || 'Active Auction',
            winningDiscount: Number(latestLog?.winning_bid || 0),
            netPayout: Number(latestLog?.net_payout || g.total_value),
            dividend: 0,
            fixedInstallment: installment,
          };
        });

        setGroupsMetadata(metaMap);
        setActiveGroupKey(prev => prev && metaMap[prev] ? prev : groupsData[0].id);
      }
    } catch (err) {
      console.error('Error fetching broadcast groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Compile broadcast text dynamically based on selected group, template, and signature
  useEffect(() => {
    const meta = groupsMetadata[activeGroupKey];
    if (!meta) return;

    let text = '';
    const formattedInstallment = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(meta.fixedInstallment);

    if (templateType === 'pre-auction') {
      text = `Dear Members,\n\nGroup [${meta.name}] Auction #[Month ${meta.currentMonth}] is active on [${meta.auctionDate}].\nInstallment Dues per ticket: [${formattedInstallment}].\nPlease clear all outstanding amounts immediately.\n\nRegards,\n${signatureLine}`;
    } else {
      text = `Dear Members,\n\nGroup [${meta.name}] Auction #[Month ${meta.currentMonth}] completed.\nWinner: [${meta.winnerName}] with a winning discount of [${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(meta.winningDiscount)}].\nNet Payout: [${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(meta.netPayout)}].\n\nRegards,\n${signatureLine}`;
    }
    setBroadcastText(text);
  }, [activeGroupKey, templateType, signatureLine, groupsMetadata]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(broadcastText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatWhatsAppUrl = () => {
    return `https://web.whatsapp.com/send?text=${encodeURIComponent(broadcastText)}`;
  };

  const selectedMeta = groupsMetadata[activeGroupKey];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <MessageSquare size={22} />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Communication & WhatsApp Broadcaster</h2>
          </div>
          <p className="text-xs text-emerald-200/80">
            Generate and broadcast monthly pre-auction notices and post-auction winner summaries directly to subscribers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 bg-white/10 rounded-xl border border-white/10 flex items-center gap-1.5">
            <Sparkles size={13} className="text-emerald-400" />
            1-Click WhatsApp Blast
          </span>
        </div>
      </div>

      {/* Organization Signature Configuration Card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
            <FileText size={14} className="text-indigo-600" />
            Organization Text Signature
          </h4>
          <p className="text-[11px] text-gray-500 mt-0.5">Appended to the footer of all compiled WhatsApp broadcast templates</p>
        </div>
        <input
          type="text"
          value={signatureLine}
          onChange={(e) => setSignatureLine(e.target.value)}
          className="w-full sm:w-80 bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:outline-none font-semibold shadow-xs"
          placeholder="e.g. Dr. Kishor Anbazhakan's Organization"
        />
      </div>

      {/* One-Tap WhatsApp Broadcast Center */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-100 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Send size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">One-Tap WhatsApp Broadcast Engine</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Select a chit group and template type to compile custom broadcast copy</p>
            </div>
          </div>
          
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setTemplateType('pre-auction')}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all duration-150 ${
                templateType === 'pre-auction' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pre-Auction Reminder
            </button>
            <button
              onClick={() => setTemplateType('post-auction')}
              className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all duration-150 ${
                templateType === 'post-auction' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Post-Auction Summary
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          <div className="space-y-4 lg:col-span-1">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Select Chit Group</label>
              <select
                value={activeGroupKey}
                onChange={(e) => setActiveGroupKey(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-gray-900 focus:outline-none"
              >
                {Object.values(groupsMetadata).map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedMeta && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Active Group Details</span>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Current Month:</span>
                  <span className="font-bold text-gray-900">Month {selectedMeta.currentMonth}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Next Auction Date:</span>
                  <span className="font-bold text-indigo-700">{selectedMeta.auctionDate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Fixed Installment:</span>
                  <span className="font-bold text-emerald-700">₹{selectedMeta.fixedInstallment.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 lg:col-span-3">
            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
              Compiled Message Broadcast Block
            </label>
            <textarea
              rows={7}
              value={broadcastText}
              onChange={(e) => setBroadcastText(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl p-3.5 text-xs text-gray-800 font-mono focus:outline-none resize-none leading-relaxed shadow-xs"
            />

            <div className="flex flex-wrap gap-2 justify-end pt-1">
              <button
                onClick={handleCopyText}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-4 py-2 rounded-xl flex items-center space-x-1.5 transition-colors border border-gray-200"
              >
                {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
              </button>

              <a
                href={formatWhatsAppUrl()}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <Send size={14} />
                <span>Share via WhatsApp Web</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
