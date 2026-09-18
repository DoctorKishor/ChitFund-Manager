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

  // Save Member (Add or Edit)
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) {
      alert('Please enter member name.');
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
            phone_number: newPhoneNumber.trim(),
          })
          .eq('id', editingMember.id);

        if (error) throw error;

        if (onAddAuditLog) {
          onAddAuditLog(`PROFILE UPDATED: ${newFullName.trim()} (${newPhoneNumber.trim()})`);
        }
      } else {
        // Insert new profile
        const { error } = await supabase
          .from('profiles')
          .insert({
            full_name: newFullName.trim(),
            phone_number: newPhoneNumber.trim(),
            role: 'subscriber',
          });

        if (error) throw error;

        if (onAddAuditLog) {
          onAddAuditLog(`NEW MEMBER ENROLLED: ${newFullName.trim()} (${newPhoneNumber.trim()})`);
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
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Top Search and Add Member Control Bar (Matching ChitBase) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <Search size={15} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search name, phone, tickets, chits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-bold text-gray-500">
            {filteredMembers.length} {filteredMembers.length === 1 ? 'member' : 'members'}
          </span>

          <button
            onClick={handleOpenAddModal}
            className="bg-slate-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm flex items-center gap-1.5 shrink-0"
          >
            <Plus size={15} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      {/* Members Directory Table */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50/80 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-400 font-bold">
              <tr>
                <th className="py-3.5 px-5">Name</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Enrolled Chits & Tickets</th>
                <th className="py-3.5 px-4">Portal Status</th>
                <th className="py-3.5 px-4 text-center">Physical Ledger</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-400 text-xs">
                    No members found matching your search. Use "Add Member" to enroll new subscribers.
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
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                            {initial}
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block text-xs group-hover:text-indigo-600 transition-colors">
                              {member.fullName}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              ID: {member.id.slice(0, 8)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono font-medium text-gray-600">
                        {member.phoneNumber || '—'}
                      </td>

                      {/* Enrolled Chits */}
                      <td className="py-3.5 px-4">
                        {member.groups.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {member.groups.map((g, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 text-[10px] font-semibold px-2 py-0.5 rounded-md border border-gray-200"
                              >
                                <span>{g.name}</span>
                                <strong className="text-indigo-600 font-mono">#{g.ticket}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[11px]">No active groups</span>
                        )}
                      </td>

                      {/* Portal */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isSubscriber 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          <span>{isSubscriber ? 'Active' : 'Admin'}</span>
                        </span>
                      </td>

                      {/* Physical Book Sync */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={(e) => handleToggleSync(e, member.id)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-all inline-flex items-center gap-1 ${
                            member.physicalBookSynced
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          <BookOpen size={11} />
                          <span>{member.physicalBookSynced ? 'SYNCED' : 'PENDING'}</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditModal(e, member)}
                            title="Edit member profile"
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteMember(e, member)}
                            title="Remove member"
                            className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                          <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-600 transition-colors ml-1" />
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
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Phone Number</label>
              <input
                type="tel"
                placeholder="e.g. 9842235740"
                value={newPhoneNumber}
                onChange={(e) => setNewPhoneNumber(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-semibold text-gray-900 focus:outline-none font-mono"
              />
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
