'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import MemberDetailsView from './MemberDetailsView';
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
  Plus
} from 'lucide-react';

interface Member {
  id: string;
  fullName: string;
  phoneNumber: string;
  role: string;
  groups: { id: string; name: string; ticket: number }[];
  physicalBookSynced: boolean;
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

  // Fetch real subscribers, enrolled groups, and audit logs from Supabase
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

  // Normalize phone number to core 10 digits
  const normalizePhoneDigits = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  // Save Member (Add or Edit)
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) {
      alert('Please enter a member full name.');
      return;
    }

    const coreDigits = normalizePhoneDigits(newPhoneNumber);
    if (!newPhoneNumber.trim() || coreDigits.length === 0) {
      alert('Phone Number Required:\n\nPlease enter a valid 10-digit mobile number.');
      return;
    }

    if (coreDigits.length < 10) {
      alert(`Invalid Phone Number Warning:\n\nThe phone number entered is too short (${coreDigits.length}/10 digits).\nExpected exactly 10 digits (e.g. 9842235740). You entered: "${newPhoneNumber}". Please check and re-enter.`);
      return;
    }

    if (coreDigits.length > 10) {
      alert(`Invalid Phone Number Warning:\n\nThe phone number entered has too many digits (${coreDigits.length}/10 digits).\nExpected exactly 10 digits (e.g. 9842235740). You entered: "${newPhoneNumber}". Please check and re-enter.`);
      return;
    }

    try {
      setIsSubmitting(true);

      if (editingMember) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: newFullName.trim(),
            phone_number: coreDigits,
          })
          .eq('id', editingMember.id);

        if (error) throw error;

        if (onAddAuditLog) {
          onAddAuditLog(`PROFILE UPDATED: ${newFullName.trim()} (${coreDigits})`);
        }
      } else {
        // Insert new profile
        const { error } = await supabase
          .from('profiles')
          .insert({
            full_name: newFullName.trim(),
            phone_number: coreDigits,
            role: 'subscriber',
          });

        if (error) throw error;

        if (onAddAuditLog) {
          onAddAuditLog(`NEW MEMBER ENROLLED: ${newFullName.trim()} (${coreDigits})`);
        }
      }

      setIsAddModalOpen(false);
      await fetchData();
    } catch (err: any) {
      console.error('Error saving member:', err);
      alert('Failed to save member: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Member
  const handleDeleteMember = async (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to remove member "${member.fullName}"?`)) return;

    try {
      // 1. Delete group memberships first
      await supabase.from('group_members').delete().eq('profile_id', member.id);
      // 2. Delete profile
      await supabase.from('profiles').delete().eq('id', member.id);

      if (onAddAuditLog) {
        onAddAuditLog(`MEMBER DELETED: ${member.fullName}`);
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
      
      {/* Top Search and Add Member Control Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search size={15} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone, tickets, chits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2.5 text-xs font-semibold text-gray-900 focus:outline-none shadow-2xs"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-bold text-gray-500">
            {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
          </span>

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
                  {/* Quick Contact buttons */}
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
                        <a
                          href={`https://wa.me/91${cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-emerald-200 active:scale-95 transition-all"
                        >
                          <span>WhatsApp</span>
                        </a>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No phone</span>
                    )}
                  </div>

                  {/* Pocket Book Sync Toggle */}
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
                <th className="py-4 px-5">Enrolled Chits &amp; Tickets</th>
                <th className="py-4 px-5">Portal Status</th>
                <th className="py-4 px-5 text-center">Physical Ledger</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-gray-400 text-xs">
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
                        <div className="flex items-center justify-end gap-2">
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
                          <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-600 transition-colors ml-1" />
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveMember}
            className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-md space-y-4 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150"
          >
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold text-xs">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">
                    {editingMember ? 'Edit Member Profile' : 'Enroll New Subscriber'}
                  </h4>
                  <p className="text-[10px] text-gray-500">
                    {editingMember ? 'Update subscriber details' : 'Register member into database'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Full Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                  Phone Number (10 Digits) *
                </label>
                {newPhoneNumber.trim() && (
                  <span className={`text-[10px] font-bold ${
                    normalizePhoneDigits(newPhoneNumber).length === 10
                      ? 'text-emerald-600'
                      : normalizePhoneDigits(newPhoneNumber).length < 10
                        ? 'text-amber-600'
                        : 'text-rose-600'
                  }`}>
                    {normalizePhoneDigits(newPhoneNumber).length === 10 
                      ? '✓ Valid 10 digits' 
                      : `${normalizePhoneDigits(newPhoneNumber).length}/10 digits`}
                  </span>
                )}
              </div>
              <input
                type="tel"
                required
                placeholder="e.g. 9842235740"
                value={newPhoneNumber}
                onChange={(e) => setNewPhoneNumber(e.target.value)}
                className={`w-full bg-gray-50 border rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none font-mono ${
                  !newPhoneNumber.trim()
                    ? 'border-gray-200 focus:border-indigo-500'
                    : normalizePhoneDigits(newPhoneNumber).length === 10
                      ? 'border-emerald-400 focus:border-emerald-500 bg-emerald-50/20'
                      : 'border-amber-400 focus:border-amber-500 bg-amber-50/20'
                }`}
              />
              {newPhoneNumber.trim() && normalizePhoneDigits(newPhoneNumber).length !== 10 && (
                <p className="text-[10px] text-amber-600 font-medium">
                  ⚠️ Phone number must be exactly 10 digits ({normalizePhoneDigits(newPhoneNumber).length > 10 ? `${normalizePhoneDigits(newPhoneNumber).length - 10} digits too many` : `${10 - normalizePhoneDigits(newPhoneNumber).length} digits remaining`})
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs px-4 py-2 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check size={14} />
                <span>{isSubmitting ? 'Saving...' : editingMember ? 'Save changes' : 'Add Member'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
