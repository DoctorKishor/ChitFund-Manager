'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { 
  Users, 
  Send, 
  Copy, 
  BookOpen, 
  Check, 
  History, 
  Smartphone, 
  Laptop, 
  ExternalLink,
  CheckCircle2, 
  XCircle, 
  FileText
} from 'lucide-react';

interface Member {
  id: string;
  fullName: string;
  phoneNumber: string;
  groups: { name: string; ticket: number }[];
  physicalBookSynced: boolean;
}

interface AuditLog {
  id: string;
  timestamp: string;
  subscriberName: string;
  action: string;
  device: 'mobile' | 'desktop';
  userAgent: string;
}

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

interface MemberMatrixProps {
  onAddAuditLog?: (desc: string) => void;
}

export default function MemberMatrix({ onAddAuditLog }: MemberMatrixProps) {
  const { profile } = useAuth();
  const [groupsMetadata, setGroupsMetadata] = useState<Record<string, GroupMetadata>>({});
  const [members, setMembers] = useState<Member[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeGroupKey, setActiveGroupKey] = useState<string>('');
  const [templateType, setTemplateType] = useState<'pre-auction' | 'post-auction'>('pre-auction');
  const [copied, setCopied] = useState<boolean>(false);
  const [broadcastText, setBroadcastText] = useState<string>('');
  
  // Custom Dynamic Signature Line
  const [signatureLine, setSignatureLine] = useState<string>(
    profile?.fullName ? `${profile.fullName}'s Chit Fund Organization` : "Chit Fund Organization"
  );

  useEffect(() => {
    if (profile?.fullName) {
      setSignatureLine(`${profile.fullName}'s Chit Fund Organization`);
    }
  }, [profile]);

  // Fetch real subscribers and groups from Supabase
  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*');

      if (profilesData) {
        setMembers(
          profilesData.map((p: any) => ({
            id: p.id,
            fullName: p.full_name || 'Member',
            phoneNumber: p.phone_number || '',
            groups: [],
            physicalBookSynced: true,
          }))
        );
      }

      const { data: groupsData } = await supabase
        .from('chit_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (groupsData && groupsData.length > 0) {
        const metaMap: Record<string, GroupMetadata> = {};
        groupsData.forEach((g: any) => {
          const installment = Math.floor(Number(g.total_value) / (g.duration_months || 1));
          metaMap[g.id] = {
            id: g.id,
            name: g.name,
            currentMonth: g.current_month || 1,
            poolValue: Number(g.total_value),
            auctionDate: 'First Sunday after 10th',
            winnerName: 'Active Auction',
            winningDiscount: 0,
            netPayout: Number(g.total_value),
            dividend: 0,
            fixedInstallment: installment,
          };
        });
        setGroupsMetadata(metaMap);
        setActiveGroupKey(groupsData[0].id);
      }
    } catch (err) {
      console.error('Error fetching member matrix:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 3. Compile broadcast text dynamically based on selected group, template, and signature
  useEffect(() => {
    const meta = groupsMetadata[activeGroupKey];
    if (!meta) return;

    let text = '';
    const formattedInstallment = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(meta.fixedInstallment);

    if (templateType === 'pre-auction') {
      text = `Dear Members,\n\nGroup [${meta.name}] Auction #[Month ${meta.currentMonth}] is active on [${meta.auctionDate}].\nInstallment Dues (Ticket #${meta.id === 'g1' ? 3 : 12}): [${formattedInstallment}].\nPlease clear all outstanding amounts immediately.\n\nRegards,\n${signatureLine}`;
    } else {
      text = `Dear Members,\n\nGroup [${meta.name}] Auction #[Month ${meta.currentMonth}] completed.\nWinner: [${meta.winnerName}] (Ticket #${meta.id === 'g1' ? 4 : 12}) with a discount of [${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(meta.winningDiscount)}].\nNet Payout: [${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(meta.netPayout)}].\nDivided Dividend distributed per member: [${new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(meta.dividend)}].\n\nRegards,\n${signatureLine}`;
    }
    setBroadcastText(text);
  }, [activeGroupKey, templateType, signatureLine]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(broadcastText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleSync = (memberId: string) => {
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const nextState = !member.physicalBookSynced;
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, physicalBookSynced: nextState } : m));

    // Send update back to the main system dashboard audit feed
    if (onAddAuditLog) {
      onAddAuditLog(
        `UPDATE physical pocket book sync state to [${nextState ? 'YES' : 'NO'}] for subscriber ${member.fullName}`
      );
    }
  };

  // Compile full URL-encoded string using the standard web scheme (https://web.whatsapp.com/send?text=...)
  const formatWhatsAppUrl = () => {
    return `https://web.whatsapp.com/send?text=${encodeURIComponent(broadcastText)}`;
  };

  return (
    <div className="space-y-6">
      
      {/* Organization Signature Configuration Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Organization Text Signature</h4>
          <p className="text-[10px] text-gray-500 mt-0.5">Appended to the footer of all compiled WhatsApp templates</p>
        </div>
        <input
          type="text"
          value={signatureLine}
          onChange={(e) => setSignatureLine(e.target.value)}
          className="w-full sm:w-80 bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-3 py-1.5 text-xs text-gray-900 focus:outline-none font-semibold"
          placeholder="e.g. Dr. Kishor Anbazhakan's Organization"
        />
      </div>

      {/* One-Tap WhatsApp Broadcast Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Send size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">One-Tap WhatsApp Broadcast Center</h3>
              <p className="text-[11px] text-gray-500 mt-0.5">Quickly compile and broadcast chit updates directly to your group chats</p>
            </div>
          </div>
          
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg p-1">
            <button
              onClick={() => setTemplateType('pre-auction')}
              className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all duration-150 ${
                templateType === 'pre-auction' 
                  ? 'bg-gray-900 text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Pre-Auction Reminder
            </button>
            <button
              onClick={() => setTemplateType('post-auction')}
              className={`text-[10px] font-bold px-3 py-1.5 rounded transition-all duration-150 ${
                templateType === 'post-auction' 
                  ? 'bg-gray-900 text-white shadow-sm' 
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              Post-Auction Summary
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          <div className="space-y-3.5 lg:col-span-1">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Select Chit Group</label>
              <select
                value={activeGroupKey}
                onChange={(e) => setActiveGroupKey(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
              >
                {Object.keys(groupsMetadata).length === 0 ? (
                  <option value="">No Groups Found</option>
                ) : (
                  Object.values(groupsMetadata).map((grp) => (
                    <option key={grp.id} value={grp.id}>
                      {grp.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="p-3 bg-gray-50 border border-gray-150 rounded-lg space-y-2 text-xs">
              <span className="text-[10px] font-bold text-gray-400 uppercase block">Active Group Details</span>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Month:</span>
                <span className="font-semibold text-gray-900">Month {groupsMetadata[activeGroupKey]?.currentMonth}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Next Auction Date:</span>
                <span className="font-semibold text-gray-900">{groupsMetadata[activeGroupKey]?.auctionDate}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Compiled Message Broadcast Block</span>
              <textarea
                readOnly
                value={broadcastText}
                rows={5}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded p-3 text-xs text-gray-800 focus:outline-none font-medium leading-relaxed resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCopyText}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs px-4 py-2 rounded-lg transition-colors border border-gray-200"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy to Clipboard
                  </>
                )}
              </button>

              <a
                href={formatWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                <ExternalLink size={14} />
                Share via WhatsApp Web
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split Layout Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* 1. Left Side: High-Density Member Table (60% width) */}
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
            <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <Users size={14} className="text-indigo-600" />
              Member Directory Matrix
            </h3>
            <span className="text-[10px] text-gray-500">Total spots registered: {members.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-gray-600">
              <thead className="text-[10px] text-gray-500 uppercase bg-gray-50">
                <tr>
                  <th className="py-2.5 px-3">Subscriber</th>
                  <th className="py-2.5 px-3">Verified Contact</th>
                  <th className="py-2.5 px-3">Groups / Tickets</th>
                  <th className="py-2.5 px-3 text-right">Pocket Book Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-400 text-xs">
                      <Users size={20} className="mx-auto mb-2 text-indigo-400 opacity-60" />
                      No members registered yet in database.
                    </td>
                  </tr>
                ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-3">
                      <span className="font-semibold text-gray-900 block">{member.fullName}</span>
                      <span className="text-[9px] text-indigo-600 font-bold uppercase mt-0.5 inline-block">SUBSCRIBER</span>
                    </td>
                    <td className="py-3 px-3 font-medium text-gray-600">
                      {member.phoneNumber}
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        {member.groups && member.groups.length > 0 ? (
                          member.groups.map((g, idx) => (
                            <span key={idx} className="block text-[10px] text-gray-500">
                              <span className="font-semibold text-gray-700">{g.name}</span> (Ticket #{g.ticket})
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-gray-400 italic">No chits assigned</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {/* Pocket Log Book Sync Toggle */}
                      <button
                        onClick={() => handleToggleSync(member.id)}
                        className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2.5 py-1.5 rounded-lg border transition-all duration-150 ${
                          member.physicalBookSynced
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-red-50 text-red-700 border-red-200'
                        }`}
                      >
                        <BookOpen size={10} />
                        {member.physicalBookSynced ? 'Book Updated: Yes' : 'Book Updated: No'}
                      </button>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Right Side: Subscriber Behavior Audit Trail (40% width) */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
            <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <History size={14} className="text-indigo-600" />
              Subscriber Portal Audit Log
            </h3>
            <span className="text-[9px] text-indigo-600 font-bold bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
              Real-time Feed
            </span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                <History size={18} className="mx-auto mb-2 text-gray-300" />
                No audit activities logged yet.
              </div>
            ) : (
              auditLogs.map((log) => (
              <div key={log.id} className="bg-gray-50 border border-gray-150 p-3 rounded-lg space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-900">{log.subscriberName}</span>
                  <span className="text-[9px] text-gray-500 font-mono">{log.timestamp}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600">{log.action}</span>
                  
                  <div className="flex items-center gap-1 text-[9px] text-gray-500">
                     {log.device === 'mobile' ? <Smartphone size={10} /> : <Laptop size={10} />}
                    <span>{log.userAgent}</span>
                  </div>
                </div>
              </div>
            )))}
          </div>
        </div>

      </div>

    </div>
  );
}
