'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MemberDetailsView from './MemberDetailsView';
import PassbookScannerModal from './PassbookScannerModal';
import PassbookSheetGeneratorModal, { StickerItem } from './PassbookSheetGeneratorModal';
import PassbookInventoryModal from './PassbookInventoryModal';
import { getPassbookScanUrl } from '@/utils/qrCodeGenerator';
import { 
  Users, 
  Search, 
  UserPlus, 
  BookOpen, 
  Check, 
  Phone, 
  Mail, 
  Edit3, 
  Trash2, 
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  X,
  Plus,
  QrCode,
  Printer,
  Layers,
  Sparkles,
  Share2
} from 'lucide-react';

interface Member {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  groups: { id: string; name: string; ticket: number }[];
  physicalBookSynced: boolean;
  passbookToken?: string;
  mpin?: string;
}

interface MemberMatrixProps {
  onAddAuditLog?: (desc: string) => void;
}

export default function MemberMatrix({ onAddAuditLog }: MemberMatrixProps) {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Add/Edit Member Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newPhoneNumber, setNewPhoneNumber] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Passbook QR modals
  const [pairingMember, setPairingMember] = useState<Member | null>(null);
  const [isInventoryOpen, setIsInventoryOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printItems, setPrintItems] = useState<StickerItem[]>([]);
  const [printSheetTitle, setPrintSheetTitle] = useState<string>('Passbook QR Sticker Sheet');

  // Fetch real subscribers, enrolled groups, and passbook metadata from Supabase
  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch all registered profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      // 2. Fetch all group member enrollments joined with chit_groups
      const { data: memberGroupsData } = await supabase
        .from('group_members')
        .select(`
          id,
          profile_id,
          group_id,
          ticket_number,
          physical_book_synced,
          chit_groups (
            id,
            name
          )
        `);

      if (profilesData) {
        setMembers(
          profilesData.map((p: any) => {
            const memberGroupRecords = (memberGroupsData || []).filter((gm: any) => gm.profile_id === p.id);
            const assignedGroups = memberGroupRecords.map((gm: any) => {
              const groupObj = Array.isArray(gm.chit_groups) ? gm.chit_groups[0] : gm.chit_groups;
              return {
                id: gm.group_id,
                name: groupObj?.name || 'Chit Group',
                ticket: gm.ticket_number,
              };
            });
            const isSynced = memberGroupRecords.length > 0
              ? memberGroupRecords.every((gm: any) => gm.physical_book_synced)
              : true;

            return {
              id: p.id,
              fullName: p.full_name || 'Member',
              phoneNumber: p.phone_number || '',
              role: p.role || 'subscriber',
              groups: assignedGroups,
              physicalBookSynced: isSynced,
              passbookToken: p.passbook_token || undefined,
              mpin: p.mpin || '1234',
            };
          })
        );
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

  const handleToggleSync = async (e: React.MouseEvent, memberId: string) => {
    e.stopPropagation();
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const nextState = !member.physicalBookSynced;
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, physicalBookSynced: nextState } : m));

    try {
      await supabase
        .from('group_members')
        .update({ physical_book_synced: nextState })
        .eq('profile_id', memberId);

      if (onAddAuditLog) {
        onAddAuditLog(
          `UPDATE physical pocket book sync state to [${nextState ? 'YES' : 'NO'}] for subscriber ${member.fullName}`
        );
      }
    } catch (err) {
      console.error('Error updating pocket book sync in DB:', err);
    }
  };

  // 📷 Handle QR Pairing
  const handlePairScanSuccess = async (scannedToken: string) => {
    if (!pairingMember) return;

    try {
      const { data, error } = await supabase.rpc('pair_passbook_qr', {
        p_token: scannedToken,
        p_profile_id: pairingMember.id,
      });

      if (error) throw error;
      if (!data || !data.success) throw new Error(data?.error || 'Failed to pair QR code.');

      alert(`Success: Passbook QR token paired to ${pairingMember.fullName}!`);
      setPairingMember(null);
      await fetchData();

      if (onAddAuditLog) {
        onAddAuditLog(`PAIRED Passbook QR [${scannedToken.slice(0, 8)}...] to ${pairingMember.fullName}`);
      }
    } catch (err: any) {
      alert(`Pairing Failed: ${err.message}`);
    }
  };

  // 🖨️ Print Single Member Stickers (copies matching enrolled groups)
  const handlePrintMemberStickers = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    if (!member.passbookToken) {
      alert(`This member does not have a Passbook QR token linked yet. Tap "Pair Passbook QR" first.`);
      return;
    }

    const copiesCount = Math.max(1, member.groups.length);
    const items: StickerItem[] = [];

    if (member.groups.length > 0) {
      member.groups.forEach((g) => {
        items.push({
          token: member.passbookToken!,
          name: member.fullName,
          phone: member.phoneNumber,
          groupName: g.name,
          ticketNumber: g.ticket,
        });
      });
    } else {
      items.push({
        token: member.passbookToken,
        name: member.fullName,
        phone: member.phoneNumber,
        groupName: 'Universal Passbook',
      });
    }

    setPrintItems(items);
    setPrintSheetTitle(`${member.fullName} — Passbook Sticker Sheet (${items.length} copies)`);
    setIsPrintModalOpen(true);
  };

  // 🖨️ Print All Filtered Members Stickers
  const handlePrintAllStickers = () => {
    const items: StickerItem[] = [];

    filteredMembers.forEach((m) => {
      if (m.passbookToken) {
        if (m.groups.length > 0) {
          m.groups.forEach((g) => {
            items.push({
              token: m.passbookToken!,
              name: m.fullName,
              phone: m.phoneNumber,
              groupName: g.name,
              ticketNumber: g.ticket,
            });
          });
        } else {
          items.push({
            token: m.passbookToken,
            name: m.fullName,
            phone: m.phoneNumber,
            groupName: 'Universal Passbook',
          });
        }
      }
    });

    if (items.length === 0) {
      alert('No members with linked passbook tokens found in the current view.');
      return;
    }

    setPrintItems(items);
    setPrintSheetTitle(`All Members Passbook Sticker Sheet (${items.length} stickers)`);
    setIsPrintModalOpen(true);
  };

  // 💬 Share WhatsApp Passbook Card
  const handleShareWhatsApp = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    const cleanPhone = normalizePhoneDigits(member.phoneNumber);
    if (!cleanPhone) {
      alert('This member does not have a valid mobile number.');
      return;
    }

    const scanUrl = member.passbookToken ? getPassbookScanUrl(member.passbookToken) : 'https://chitfund.app';
    const message = `📱 *Hello ${member.fullName}!*
Welcome to your Chit Fund Member Portal.

Access your digital passbook, payment ledger & live auction bidding anytime:
🔗 *Passbook Direct Link*: ${scanUrl}
👤 *Mobile Number*: ${cleanPhone}
🔑 *Initial MPIN*: ${member.mpin || '1234'}

_(Point any camera at your physical pocket book QR sticker to log in instantly)_`;

    window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Open Add Member Modal
  const handleOpenAddModal = () => {
    setEditingMember(null);
    setNewFullName('');
    setNewPhoneNumber('');
    setIsAddModalOpen(true);
  };

  // Open Edit Member Modal
  const handleOpenEditModal = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    setEditingMember(member);
    setNewFullName(member.fullName);
    setNewPhoneNumber(member.phoneNumber);
    setIsAddModalOpen(true);
  };

  const normalizePhoneDigits = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  // Submit Add or Edit Member Form
  const handleSubmitMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanName = newFullName.trim();
    const cleanPhone = normalizePhoneDigits(newPhoneNumber);

    if (!cleanName) {
      alert('Please enter a valid member name.');
      return;
    }

    if (cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingMember) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: cleanName,
            phone_number: cleanPhone,
          })
          .eq('id', editingMember.id);

        if (error) throw error;

        if (onAddAuditLog) {
          onAddAuditLog(
            `EDIT profile: Updated details for subscriber ${cleanName} (${cleanPhone})`
          );
        }
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            full_name: cleanName,
            phone_number: cleanPhone,
            role: 'subscriber',
          });

        if (error) throw error;

        if (onAddAuditLog) {
          onAddAuditLog(
            `REGISTER new subscriber: Created profile for ${cleanName} (${cleanPhone})`
          );
        }
      }

      setIsAddModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving member:', err);
      alert('Database error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Member Profile
  const handleDeleteMember = async (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to remove ${member.fullName}? This will unenroll them from all chits.`)) {
      return;
    }

    try {
      await supabase.from('group_members').delete().eq('profile_id', member.id);
      const { error } = await supabase.from('profiles').delete().eq('id', member.id);
      if (error) throw error;

      if (onAddAuditLog) {
        onAddAuditLog(`DELETE subscriber profile: Removed ${member.fullName}`);
      }

      await fetchData();
    } catch (err: any) {
      console.error('Error deleting member:', err);
      alert('Error deleting member: ' + err.message);
    }
  };

  // Filtered members list
  const filteredMembers = members.filter(m => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return m.fullName.toLowerCase().includes(q) ||
      m.phoneNumber.toLowerCase().includes(q) ||
      m.groups.some(g => g.name.toLowerCase().includes(q) || String(g.ticket).includes(q));
  });

  // If a member is selected, render their dedicated Member Profile Detail Page!
  if (selectedMemberId) {
    return (
      <MemberDetailsView
        memberId={selectedMemberId}
        onBack={() => setSelectedMemberId(null)}
        onAddAuditLog={onAddAuditLog}
      />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      
      {/* Top Search and Action Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search size={15} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone, tickets, chits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none shadow-2xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
          <button
            type="button"
            onClick={() => setIsInventoryOpen(true)}
            className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
          >
            <Layers size={14} className="text-indigo-600" />
            <span>Blank QR Inventory</span>
          </button>

          <button
            type="button"
            onClick={handlePrintAllStickers}
            className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all shadow-2xs flex items-center gap-1.5 active:scale-95"
          >
            <Printer size={14} className="text-indigo-600" />
            <span>Print All Stickers</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
          >
            <Plus size={15} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* ── MOBILE MEMBER CARDS STREAM (md:hidden) ── */}
      <div className="md:hidden space-y-3.5">
        {filteredMembers.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center text-gray-400 text-xs shadow-2xs">
            No members found matching your search. Use &quot;Add Member&quot; to enroll new subscribers.
          </div>
        ) : (
          filteredMembers.map((member) => {
            const initial = member.fullName.charAt(0).toUpperCase();
            const isSubscriber = member.role === 'subscriber';
            const cleanPhone = normalizePhoneDigits(member.phoneNumber);

            return (
              <div
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className="bg-white border border-gray-200 hover:border-gray-300 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs transition-all active:scale-[0.99] cursor-pointer"
              >
                {/* Member Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white font-extrabold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                      {initial}
                    </div>
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm leading-snug">{member.fullName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                          isSubscriber 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          {isSubscriber ? 'Active' : 'Admin'}
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono block">
                        ID: {member.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditModal(e, member)}
                      title="Edit member"
                      className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors active:scale-95"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteMember(e, member)}
                      title="Remove member"
                      className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors active:scale-95"
                    >
                      <Trash2 size={15} />
                    </button>
                    <ChevronRight size={18} className="text-gray-400 ml-0.5" />
                  </div>
                </div>

                {/* Passbook QR Status Pill */}
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-gray-150 text-xs">
                  <div className="flex items-center gap-1.5">
                    <QrCode size={14} className={member.passbookToken ? 'text-indigo-600' : 'text-gray-400'} />
                    <span className="font-bold text-gray-700 text-[11px]">Passbook QR:</span>
                    {member.passbookToken ? (
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                        Linked 🟢
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-md">
                        Unlinked
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPairingMember(member);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2.5 py-1 rounded-lg shadow-2xs"
                    >
                      {member.passbookToken ? 'Re-Pair 📷' : 'Pair QR 📷'}
                    </button>

                    {member.passbookToken && (
                      <button
                        type="button"
                        onClick={(e) => handlePrintMemberStickers(e, member)}
                        title="Print stickers"
                        className="p-1 text-gray-600 hover:text-indigo-600 bg-white border border-gray-200 rounded-lg"
                      >
                        <Printer size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Enrolled Chits Badges */}
                {member.groups.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {member.groups.map((g, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 bg-gray-50 text-gray-800 text-xs font-semibold px-2.5 py-1 rounded-xl border border-gray-200/80"
                      >
                        <span>{g.name}</span>
                        <strong className="text-indigo-600 font-mono">#{g.ticket}</strong>
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer with Direct Phone/WhatsApp & Physical Book Sync */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    {cleanPhone ? (
                      <>
                        <a
                          href={`tel:+91${cleanPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-gray-200 active:scale-95 transition-all"
                        >
                          <Phone size={12} className="text-indigo-600" />
                          <span>Call</span>
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleShareWhatsApp(e, member)}
                          className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-emerald-200 active:scale-95 transition-all"
                        >
                          <Share2 size={12} />
                          <span>WhatsApp</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No phone</span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleToggleSync(e, member.id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all inline-flex items-center gap-1.5 active:scale-95 ${
                      member.physicalBookSynced
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    <BookOpen size={13} />
                    <span>{member.physicalBookSynced ? 'SYNCED' : 'PENDING'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── DESKTOP MEMBERS DIRECTORY TABLE (hidden md:block) ── */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-3xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              <tr>
                <th className="py-4 px-6">Name</th>
                <th className="py-4 px-5">Phone</th>
                <th className="py-4 px-5">Passbook QR Key</th>
                <th className="py-4 px-5">Enrolled Chits &amp; Tickets</th>
                <th className="py-4 px-5">Portal Status</th>
                <th className="py-4 px-5 text-center">Physical Ledger</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-gray-400 text-xs">
                    No members found matching your search. Use &quot;Add Member&quot; to enroll new subscribers.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const initial = member.fullName.charAt(0).toUpperCase();
                  const isSubscriber = member.role === 'subscriber';

                  return (
                    <tr
                      key={member.id}
                      onClick={() => setSelectedMemberId(member.id)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      {/* Name with Avatar */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            {initial}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block text-xs group-hover:text-indigo-600 transition-colors leading-snug">
                              {member.fullName}
                            </span>
                            <span className="text-[11px] text-gray-400 font-mono mt-0.5 block">
                              ID: {member.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-5 font-mono font-medium text-gray-600 text-xs">
                        {member.phoneNumber || '—'}
                      </td>

                      {/* Passbook QR Status & Actions */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          {member.passbookToken ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                              <CheckCircle2 size={12} /> Linked
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-lg">
                              Unlinked
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPairingMember(member);
                            }}
                            title="Scan QR on physical passbook to pair"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors"
                          >
                            <QrCode size={13} />
                          </button>

                          {member.passbookToken && (
                            <button
                              type="button"
                              onClick={(e) => handlePrintMemberStickers(e, member)}
                              title="Print A4 sticker sheet for this member"
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-gray-200 rounded-lg transition-colors"
                            >
                              <Printer size={13} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Enrolled Chits */}
                      <td className="py-4 px-5">
                        {member.groups.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {member.groups.map((g, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-gray-200"
                              >
                                <span>{g.name}</span>
                                <strong className="text-indigo-600 font-mono">#{g.ticket}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-xs">No active groups</span>
                        )}
                      </td>

                      {/* Portal */}
                      <td className="py-4 px-5">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                          isSubscriber 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>{isSubscriber ? 'Active' : 'Admin'}</span>
                        </span>
                      </td>

                      {/* Physical Book Sync */}
                      <td className="py-4 px-5 text-center">
                        <button
                          onClick={(e) => handleToggleSync(e, member.id)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all inline-flex items-center gap-1.5 ${
                            member.physicalBookSynced
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          <BookOpen size={13} />
                          <span>{member.physicalBookSynced ? 'SYNCED' : 'PENDING'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleShareWhatsApp(e, member)}
                            title="Share passbook login card via WhatsApp"
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                          >
                            <Share2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(e, member)}
                            title="Edit member profile"
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteMember(e, member)}
                            title="Remove member"
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Member Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                  <UserPlus size={18} />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">
                  {editingMember ? 'Edit Subscriber Profile' : 'Enroll New Subscriber'}
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitMember} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  10-Digit Mobile Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  maxLength={10}
                  value={newPhoneNumber}
                  onChange={(e) => setNewPhoneNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 font-mono focus:outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                >
                  {isSubmitting ? 'Saving...' : editingMember ? 'Update Profile' : 'Enroll Subscriber'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Camera QR Scanner Modal for Pairing */}
      <PassbookScannerModal
        isOpen={!!pairingMember}
        onClose={() => setPairingMember(null)}
        onScanSuccess={handlePairScanSuccess}
        title="Pair Physical Passbook QR"
        subtitle="Point camera at the QR sticker on the member's physical pocket book"
        targetMemberName={pairingMember?.fullName}
      />

      {/* A4 PDF Sticker Sheet Exporter */}
      <PassbookSheetGeneratorModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        items={printItems}
        defaultTitle={printSheetTitle}
      />

      {/* Blank QR Inventory Modal */}
      <PassbookInventoryModal
        isOpen={isInventoryOpen}
        onClose={() => setIsInventoryOpen(false)}
        onRefresh={fetchData}
      />
    </div>
  );
}
