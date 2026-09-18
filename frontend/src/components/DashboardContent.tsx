import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { supabase } from '../utils/supabase/client';
import LiveAuctionEngine from './LiveAuctionEngine';
import CashVaultLedger from './CashVaultLedger';
import MemberMatrix from './MemberMatrix';
import { 
  DollarSign, 
  Users, 
  Briefcase, 
  Calendar, 
  Send, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownLeft,
  Coins,
  Search,
  Check,
  X,
  ArrowRight,
  BarChart3,
  Rocket,
  CalendarDays,
  RefreshCw,
  Plus
} from 'lucide-react';

// ── Utility: First Sunday on-or-after the 10th of a given month ──────────────
function getFirstSundayOnOrAfter10th(year: number, month: number): Date {
  const d = new Date(year, month, 10);
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function formatAuctionDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── FIFO Ledger Types ─────────────────────────────────────────────────────────
interface LedgerEntry {
  month: number;
  label: string;
  original: number;
  paid: number;
}

interface FifoMember {
  id: string;
  name: string;
  ticket: number;
  group: string;
  ledger: LedgerEntry[];
}

interface DashboardContentProps {
  activeTab: string;
}

export default function DashboardContent({ activeTab }: DashboardContentProps) {
  const { profile } = useAuth();
  const { balances, triggerMockTransaction, updateBalance } = useWallet();

  // Group Creation & Enrollment States
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupValue, setNewGroupValue] = useState('100000');
  const [newGroupDuration, setNewGroupDuration] = useState('5');
  const [enrollments, setEnrollments] = useState<{ name: string; phone: string }[]>([
    { name: '', phone: '' },
    { name: '', phone: '' },
    { name: '', phone: '' },
    { name: '', phone: '' },
    { name: '', phone: '' },
  ]);

  // Wizard Setup States
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');

  // Live Supabase Directory
  const [masterDirectory, setMasterDirectory] = useState<{ name: string; phone: string }[]>([]);

  // Chits Directory Switcher States (Loaded from Supabase)
  const [showWizard, setShowWizard] = useState(false);
  const [groupFilter, setGroupFilter] = useState<'active' | 'all'>('active');
  const [localGroups, setLocalGroups] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Fetch real groups from Supabase
  const fetchGroups = async () => {
    try {
      setLoadingGroups(true);
      const { data, error } = await supabase
        .from('chit_groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('chit_groups fetch note:', error.message);
        return;
      }

      if (data) {
        setLocalGroups(
          data.map((g: any) => ({
            id: g.id,
            name: g.name,
            totalValue: Number(g.total_value),
            currentMonth: g.current_month || 1,
            duration: g.duration_months,
            active: true,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching groups from Supabase:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Fetch registered profiles from Supabase
  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone_number');

      if (data && data.length > 0) {
        setMasterDirectory(
          data.map((p: any) => ({
            name: p.full_name,
            phone: p.phone_number,
          }))
        );
      }
    } catch (err) {
      console.error('Error fetching directory:', err);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchProfiles();
  }, []);

  // Auction Date Reschedule Override State: { [groupId]: ISO date string }
  const [auctionDateOverrides, setAuctionDateOverrides] = useState<Record<string, string>>({});
  const [rescheduleGroupId, setRescheduleGroupId] = useState<string | null>(null);
  const [rescheduleInputVal, setRescheduleInputVal] = useState<string>('');

  // Compute canonical auction date for a group (uses today's month/year as calendar anchor)
  const getGroupAuctionDate = (groupId: string): { display: string; isOverride: boolean } => {
    if (auctionDateOverrides[groupId]) {
      const parts = auctionDateOverrides[groupId].split('-');
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      return { display: formatAuctionDate(d) + ' (Override)', isOverride: true };
    }
    const now = new Date();
    const canonical = getFirstSundayOnOrAfter10th(now.getFullYear(), now.getMonth());
    return { display: formatAuctionDate(canonical), isOverride: false };
  };

  // Reports Center Natural Language States
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Dashboard Dues & Collection States (Real defaults: 0)
  const [actualCollections, setActualCollections] = useState(0);
  const targetCollections = useMemo(() => {
    return localGroups.reduce((acc, g) => acc + (g.totalValue / (g.duration || 1)), 0);
  }, [localGroups]);

  // FIFO Cumulative Ledger — Starts empty until groups & dues are registered
  const [fifoMembers, setFifoMembers] = useState<FifoMember[]>([]);

  // Derive total outstanding per member
  const getMemberTotalDue = (member: FifoMember) =>
    member.ledger.reduce((sum, e) => sum + (e.original - e.paid), 0);

  // Expanded ledger rows state
  const [expandedLedgerIds, setExpandedLedgerIds] = useState<string[]>([]);

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'UPI' | 'Bank' | 'Cheque'>('Cash');

  // Derive selected member for payment dialog
  const selectedFifoMember = fifoMembers.find(m => m.id === selectedMemberId) ?? null;
  const selectedMemberTotalDue = selectedFifoMember ? getMemberTotalDue(selectedFifoMember) : 0;

  // Dynamic Audit Log State (Starts empty, records live actions)
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const handleDurationChange = (val: string) => {
    setNewGroupDuration(val);
    const num = Number(val);
    if (isNaN(num) || num <= 0) return;
    
    setEnrollments(prev => {
      const copy = [...prev];
      if (copy.length < num) {
        while (copy.length < num) {
          copy.push({ name: '', phone: '' });
        }
      } else if (copy.length > num) {
        return copy.slice(0, num);
      }
      return copy;
    });
  };

  const handleEnrollmentChange = (index: number, field: 'name' | 'phone', val: string) => {
    setEnrollments(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    const duration = Number(newGroupDuration);
    
    if (enrollments.length !== duration) {
      alert(`Validation Failure: Enrolled spots (${enrollments.length}) must exactly equal group duration in months (${duration}).`);
      return;
    }

    const isAnyEmpty = enrollments.some(slot => !slot.name.trim() || !slot.phone.trim());
    if (isAnyEmpty) {
      alert(`Validation Failure: All ${duration} member slots must be fully enrolled with Name and Phone Number to satisfy strict duration constraints.`);
      return;
    }

    try {
      const { data, error } = await supabase.from('chit_groups').insert({
        name: newGroupName,
        total_value: Number(newGroupValue),
        member_count: duration,
        duration_months: duration,
        current_month: 1,
        kai_iruppu_pool: 0,
      }).select().single();

      if (error) {
        alert(`Failed to create group in database: ${error.message}`);
        return;
      }

      alert(`Success: Chit Group "${newGroupName}" created in Supabase! \nPool Value: ₹${newGroupValue}\nDuration: ${duration} Months.`);
      await fetchGroups();
    } catch (err: any) {
      alert(`Error creating group: ${err.message}`);
    }
    
    // Reset form
    setNewGroupName('');
    setNewGroupValue('100000');
    setNewGroupDuration('5');
    setEnrollments([
      { name: '', phone: '' },
      { name: '', phone: '' },
      { name: '', phone: '' },
      { name: '', phone: '' },
      { name: '', phone: '' },
    ]);
    setWizardStep(1);
    setShowWizard(false);
  };

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(paymentAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    const member = fifoMembers.find(m => m.id === selectedMemberId);
    if (!member) return;

    const totalDue = getMemberTotalDue(member);
    if (amountNum > totalDue) {
      alert(`Payment (₹${amountNum.toLocaleString('en-IN')}) exceeds FIFO cumulative balance (₹${totalDue.toLocaleString('en-IN')}).`);
      return;
    }

    // FIFO Walk: apply credit to oldest unpaid ledger entries first
    let remaining = amountNum;
    const updatedLedger = member.ledger.map(entry => {
      if (remaining <= 0) return entry;
      const owed = entry.original - entry.paid;
      if (owed <= 0) return entry;
      const applying = Math.min(remaining, owed);
      remaining -= applying;
      return { ...entry, paid: entry.paid + applying };
    });

    setFifoMembers(prev => prev.map(m =>
      m.id === selectedMemberId ? { ...m, ledger: updatedLedger } : m
    ));

    setActualCollections(prev => prev + amountNum);

    let targetWallet: 'cash_in_hand' | 'kishor_bank' | 'dad_bank' | 'mom_bank' = 'cash_in_hand';
    if (paymentMode === 'UPI') targetWallet = 'kishor_bank';
    if (paymentMode === 'Bank') targetWallet = 'dad_bank';
    if (paymentMode === 'Cheque') targetWallet = 'mom_bank';
    updateBalance(targetWallet, amountNum);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    setAuditLogs(prev => [
      {
        timestamp: `Today, ${timeStr}`,
        table: 'transactions',
        desc: `FIFO CREDIT ₹${amountNum.toLocaleString('en-IN')} via ${paymentMode} from ${member.name} — oldest arrears cleared first`,
        executor: 'Kishor (Admin)'
      },
      ...prev
    ]);

    setSelectedMemberId(null);
    setPaymentAmount('');
    alert(`FIFO credit of ₹${amountNum.toLocaleString('en-IN')} applied. Oldest overdue balances cleared first.`);
  };

  const isUserAdminOrManager = profile?.role === 'admin' || profile?.role === 'manager';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Render content based on active tab and simulated role
  switch (activeTab) {
    case 'dashboard':
      return (
        <div className="space-y-6">
          {/* Dashboard Header Banner */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 relative overflow-hidden shadow-sm">
            <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10 space-y-2">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                System Workspace
              </span>
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                Welcome back, {profile?.fullName || 'User'}!
              </h2>
              <p className="text-sm text-gray-500 max-w-xl">
                You are currently viewing the workspace as an <span className="font-semibold text-indigo-600 uppercase">{profile?.role || 'Subscriber'}</span>.
                {profile?.role === 'subscriber' && " Administrative tabs and actions are restricted."}
              </p>
            </div>
          </div>

          {/* ChitBase Collection Progress Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 relative overflow-hidden shadow-sm">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Target vs Actual Collections</span>
                <h3 className="text-base font-bold text-gray-900 mt-1">Monthly Chit Collections Progress</h3>
                <p className="text-xs text-gray-500 mt-0.5">Baseline collection targets set against physical receipts</p>
              </div>
              <div className="text-right space-y-1">
                <span className="text-xs text-gray-500">Total target: <strong className="text-gray-900">{formatCurrency(targetCollections)}</strong></span>
                <div className="text-xl font-extrabold text-indigo-650 mt-0.5">
                  {formatCurrency(actualCollections)} <span className="text-xs text-gray-400 font-normal">collected</span>
                </div>
                {/* Auction Date Display */}
                {(() => {
                  const { display, isOverride } = getGroupAuctionDate('g1');
                  return (
                    <div className="flex items-center justify-end gap-1.5 text-[10px] text-gray-500">
                      <CalendarDays size={11} className="text-indigo-600" />
                      <span>Next Auction: <span className={`font-semibold ${isOverride ? 'text-amber-600' : 'text-gray-700'}`}>{display}</span></span>
                      <button
                        onClick={() => { setRescheduleGroupId('g1'); setRescheduleInputVal(auctionDateOverrides['g1'] || ''); }}
                        className="ml-1 text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded hover:bg-indigo-100 transition-colors"
                      >
                        Reschedule
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4 space-y-1.5">
              <div className="w-full bg-gray-50 rounded-full h-3 overflow-hidden border border-gray-200">
                <div 
                  className="bg-indigo-650 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, (actualCollections / targetCollections) * 100)}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-semibold">
                <span>{((actualCollections / targetCollections) * 100).toFixed(1)}% Completed</span>
                <span>Remaining: {formatCurrency(Math.max(0, targetCollections - actualCollections))}</span>
              </div>
            </div>
          </div>

          {/* FIFO Cumulative Ledger: "Yet to Pay" Member Directory */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 relative shadow-sm">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Users size={16} className="text-indigo-600" />
                  FIFO Cumulative Dues Ledger
                </h3>
                <p className="text-[11px] text-gray-500 mt-0.5">Partial payments clear oldest arrears first before touching current month dues.</p>
              </div>
              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded shrink-0">
                {fifoMembers.filter(m => getMemberTotalDue(m) > 0).length} Pending
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-gray-600">
                <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 rounded-lg">
                  <tr>
                    <th className="py-2.5 px-3">Subscriber</th>
                    <th className="py-2.5 px-3">Ticket</th>
                    <th className="py-2.5 px-3">Group</th>
                    <th className="py-2.5 px-3">FIFO Balance</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fifoMembers.map((member) => {
                    const totalDue = getMemberTotalDue(member);
                    const isExpanded = expandedLedgerIds.includes(member.id);
                    const overdueCount = member.ledger.filter(e => e.month < member.ledger[member.ledger.length - 1].month && (e.original - e.paid) > 0).length;
                    return (
                      <React.Fragment key={member.id}>
                        <tr className="hover:bg-gray-50/50">
                          <td className="py-3 px-3">
                            <span className="font-semibold text-gray-900 block">{member.name}</span>
                            {overdueCount > 0 && (
                              <span className="text-[9px] text-red-600 font-bold uppercase">{overdueCount} overdue month{overdueCount > 1 ? 's' : ''}</span>
                            )}
                          </td>
                          <td className="py-3 px-3">#{member.ticket}</td>
                          <td className="py-3 px-3">
                            <span className="bg-gray-100 text-gray-700 border border-gray-200 px-1.5 py-0.5 rounded font-mono text-[10px]">
                              {member.group}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium">
                            {totalDue > 0 ? (
                              <div>
                                <span className="text-amber-600 font-bold">{formatCurrency(totalDue)}</span>
                                <button
                                  onClick={() => setExpandedLedgerIds(prev => isExpanded ? prev.filter(id => id !== member.id) : [...prev, member.id])}
                                  className="ml-2 text-[9px] text-indigo-600 underline"
                                >
                                  {isExpanded ? 'hide' : 'details'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-green-600 font-semibold flex items-center gap-1">
                                <CheckCircle2 size={12} /> Paid
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            {totalDue > 0 ? (
                              <button
                                onClick={() => {
                                  setSelectedMemberId(member.id);
                                  setPaymentAmount(totalDue.toString());
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded transition-all shadow-sm"
                              >
                                Record
                              </button>
                            ) : (
                              <span className="text-gray-400 font-bold text-[10px] uppercase">Cleared</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="px-3 pb-3">
                              <div className="bg-gray-50 border border-gray-150 rounded-lg p-3 space-y-1.5">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block mb-2">FIFO Ledger Breakdown (oldest first)</span>
                                {member.ledger.map((entry, idx) => {
                                  const balance = entry.original - entry.paid;
                                  return (
                                    <div key={idx} className="flex justify-between items-center text-[10px]">
                                      <span className="text-gray-500">{entry.label}</span>
                                      <div className="flex items-center gap-3">
                                        <span className="text-gray-400">Due: {formatCurrency(entry.original)}</span>
                                        <span className="text-green-600">Paid: {formatCurrency(entry.paid)}</span>
                                        <span className={`font-bold ${balance > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                                          {balance > 0 ? `Owed: ${formatCurrency(balance)}` : '✓ Cleared'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );

                  })}
                </tbody>
              </table>
            </div>

            {/* Floating Record Payment dialog with FIFO ledger context */}
            {selectedMemberId && selectedFifoMember && (
              <div className="absolute inset-0 bg-white/90 rounded-2xl z-30 flex items-center justify-center p-4 backdrop-blur-[1px]">
                <form 
                  onSubmit={handleRecordPaymentSubmit}
                  className="bg-white border border-gray-200 rounded-xl p-5 w-full max-w-sm space-y-4 shadow-2xl relative"
                >
                  <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                    <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                      <Coins size={14} className="text-indigo-600" />
                      Record FIFO Payment
                    </h4>
                    <button 
                      type="button" 
                      onClick={() => setSelectedMemberId(null)}
                      className="text-gray-450 hover:text-gray-700"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="space-y-1 text-xs">
                    <p className="text-gray-500">Subscriber: <strong className="text-gray-900">{selectedFifoMember.name}</strong></p>
                    <p className="text-gray-500">FIFO Cumulative Balance: <strong className="text-amber-600">{formatCurrency(selectedMemberTotalDue)}</strong></p>
                    <p className="text-[10px] text-indigo-600 font-semibold">Credit applies to oldest overdue entry first (FIFO order)</p>
                  </div>

                  {/* Payment Amount Input */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Payment Amount (₹)</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-2 text-xs text-gray-400 font-bold">₹</span>
                      <input
                        type="number"
                        required
                        placeholder="Amount"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-6 py-1.5 text-xs font-semibold text-gray-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Quick-Click Presets */}
                  <div className="space-y-1">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Amount Presets</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(selectedMemberTotalDue.toString())}
                        className="flex-1 bg-gray-100 hover:bg-gray-150 text-gray-700 border border-gray-200 text-[10px] font-bold py-1 rounded transition-colors"
                      >
                        Full
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(Math.floor(selectedMemberTotalDue / 2).toString())}
                        className="flex-1 bg-gray-100 hover:bg-gray-150 text-gray-700 border border-gray-200 text-[10px] font-bold py-1 rounded transition-colors"
                      >
                        Half
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentAmount('0')}
                        className="flex-1 bg-gray-100 hover:bg-gray-150 text-gray-700 border border-gray-200 text-[10px] font-bold py-1 rounded transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Payment Mode Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Payment Mode</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['Cash', 'UPI', 'Bank', 'Cheque'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMode(mode)}
                          className={`text-[9px] font-bold py-1.5 rounded transition-all border ${
                            paymentMode === mode 
                              ? 'bg-gray-900 border-black text-white shadow-sm' 
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMemberId(null)}
                      className="border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-[10px] px-3.5 py-1.5 rounded transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700 text-white font-bold text-[10px] px-4 py-1.5 rounded transition-all shadow-sm"
                    >
                      Confirm Payment
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Reschedule Date Override Popover */}
          {rescheduleGroupId && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white border border-gray-200 rounded-xl p-5 w-full max-w-xs space-y-4 shadow-2xl">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-indigo-600" />
                    Reschedule Auction Date
                  </h4>
                  <button onClick={() => setRescheduleGroupId(null)} className="text-gray-400 hover:text-gray-600">
                    <X size={14} />
                  </button>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Select New Date</label>
                  <input
                    type="date"
                    value={rescheduleInputVal}
                    onChange={(e) => setRescheduleInputVal(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Canonical (auto): {formatAuctionDate(getFirstSundayOnOrAfter10th(new Date().getFullYear(), new Date().getMonth()))}</p>
                </div>
                <div className="flex gap-2 justify-end">
                  {auctionDateOverrides[rescheduleGroupId] && (
                    <button
                      onClick={() => { setAuctionDateOverrides(prev => { const n = {...prev}; delete n[rescheduleGroupId!]; return n; }); setRescheduleGroupId(null); }}
                      className="text-[10px] font-bold text-red-650 border border-red-200 px-3 py-1.5 rounded hover:bg-red-50 transition-colors"
                    >
                      Clear Override
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (rescheduleInputVal) setAuctionDateOverrides(prev => ({ ...prev, [rescheduleGroupId!]: rescheduleInputVal }));
                      setRescheduleGroupId(null);
                    }}
                    className="bg-gray-900 hover:bg-black text-white font-bold text-[10px] px-4 py-1.5 rounded transition-colors"
                  >
                    Save Override
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Interactive Live Sync Simulation Dashboard Controller */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Simulation Controls Card */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 lg:col-span-1 shadow-sm">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Coins size={16} className="text-indigo-650" />
                Live Sync Sandbox
              </h4>
              <p className="text-xs text-gray-500 leading-relaxed">
                Click the buttons below to log simulated database transactions. These updates will instantly recalculate global balances and trigger the <strong>Top Status Ribbon</strong> pills to flash, showing our database synchronization is active.
              </p>
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => triggerMockTransaction('collection')}
                  className="w-full flex items-center justify-between text-left text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-800 px-3.5 py-3 rounded-lg font-semibold transition-all duration-200"
                >
                  <span>1. Member Cash Collection</span>
                  <span className="text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-200">+₹5,000 Cash</span>
                </button>
                <button
                  onClick={() => triggerMockTransaction('payout')}
                  className="w-full flex items-center justify-between text-left text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-800 px-3.5 py-3 rounded-lg font-semibold transition-all duration-200"
                >
                  <span>2. Disburse Auction Payout</span>
                  <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">-₹25,000 Dad Bank</span>
                </button>
                <button
                  onClick={() => triggerMockTransaction('transfer')}
                  className="w-full flex items-center justify-between text-left text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 text-gray-800 px-3.5 py-3 rounded-lg font-semibold transition-all duration-200"
                >
                  <span>3. Cash Box to Bank Transfer</span>
                  <span className="text-indigo-750 font-bold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">±₹10,000 Sync</span>
                </button>
              </div>
            </div>

            {/* Audit or Activity Stream */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 lg:col-span-2 shadow-sm">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert size={16} className="text-indigo-650" />
                Live System Audit Log
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left text-gray-600">
                  <thead className="text-[10px] text-gray-500 uppercase bg-gray-50 rounded-lg">
                    <tr>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Table</th>
                      <th className="py-2.5 px-3">Action Description</th>
                      <th className="py-2.5 px-3 text-right">Executor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {auditLogs.map((log, index) => (
                      <tr key={index} className="hover:bg-gray-50/50">
                        <td className="py-3 px-3 font-medium text-gray-400">{log.timestamp}</td>
                        <td className="py-3 px-3">
                          <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">
                            {log.table}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-700">{log.desc}</td>
                        <td className="py-3 px-3 text-right font-medium text-indigo-600">{log.executor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      );

    case 'auctions':
      return <LiveAuctionEngine />;

    case 'cash':
      return <CashVaultLedger />;

    case 'members':
      return (
        <MemberMatrix 
          onAddAuditLog={(desc) => {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
            setAuditLogs(prev => [
              {
                timestamp: `Today, ${timeStr}`,
                table: 'profiles',
                desc,
                executor: 'Kishor (Admin)'
              },
              ...prev
            ]);
          }} 
        />
      );

    case 'reports':
      return (
        <div className="space-y-6">
          
          {/* Analytical Overview Suite */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-650" />
                Reports & AI-Assisted Analytics
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Query analytics or read auto-compiled reports. Powered by natural language matching.
              </p>
            </div>

            {/* Natural Language Query Box */}
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                setIsAiLoading(true);
                setAiResponse(null);
                setTimeout(() => {
                  setIsAiLoading(false);
                  const q = aiQuery.toLowerCase();
                  if (q.includes('gold') || q.includes('monthly')) {
                    setAiResponse("AI Insight: G-Gold-Monthly-102 currently holds a 100% subscriber collections compliance rate for Month 6. Individual dividends are pro-rated to yield ₹15,555 per subscriber, presenting optimal active yield.");
                  } else if (q.includes('weekly') || q.includes('elite')) {
                    setAiResponse("AI Insight: G-Elite-Weekly-301 has accumulated ₹60,000 of its ₹1,00,000 pool. Based on installment schedules, it will trigger the Laaba Seetu lockout in Month 8, securing ₹1,00,000 total company profit.");
                  } else {
                    setAiResponse("AI Insight: Consolidated chit groups show ₹8,00,000 total value managed. Active compliance is at 94.6% with ₹3,45,000 collected. Average monthly dividend distribution yields ₹9,444 per active subscriber spot.");
                  }
                }, 1000);
              }}
              className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-150"
            >
              <div className="space-y-1">
                <label className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider block">Ask anything about your Chit funds data...</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiQuery}
                    onChange={(e) => setAiQuery(e.target.value)}
                    placeholder="e.g. How much did Priya pay in Gold-102? or Predict Laaba Seetu triggers..."
                    className="w-full bg-white border border-gray-250 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-gray-950 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shrink-0 animate-fade-in"
                  >
                    Analyze
                  </button>
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2 text-[10px]">
                <span className="text-gray-400 font-semibold self-center">Try queries:</span>
                <button
                  type="button"
                  onClick={() => setAiQuery("Analyze Gold group compliance")}
                  className="bg-white hover:bg-gray-105 border border-gray-200 text-gray-700 px-2 py-0.5 rounded transition-colors"
                >
                  "Analyze Gold group compliance"
                </button>
                <button
                  type="button"
                  onClick={() => setAiQuery("Predict Weekly Elite Laaba Seetu trigger month")}
                  className="bg-white hover:bg-gray-105 border border-gray-200 text-gray-700 px-2 py-0.5 rounded transition-colors"
                >
                  "Predict Weekly Elite Laaba Seetu trigger"
                </button>
              </div>
            </form>

            {/* AI Analytical Response display */}
            {isAiLoading && (
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center text-xs text-gray-550 space-x-2">
                <span className="h-3 w-3 border-2 border-indigo-500/30 border-t-indigo-600 rounded-full animate-spin"></span>
                <span>AI Agent analyzing treasury ledger data tables...</span>
              </div>
            )}

            {!isAiLoading && aiResponse && (
              <div className="p-4 bg-indigo-50 border border-indigo-150 rounded-xl space-y-2 animate-in slide-in-from-top-2 duration-200">
                <div className="flex justify-between items-center text-[10px] font-bold text-indigo-600 uppercase">
                  <span>AI Analytical Summary</span>
                  <span>Instant sync</span>
                </div>
                <p className="text-xs text-indigo-900 leading-relaxed font-semibold">
                  {aiResponse}
                </p>
              </div>
            )}
          </div>

          {/* Quick analytic statistics columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Average Monthly Dividend</span>
              <span className="text-lg font-bold text-gray-900 mt-1 block">₹9,444</span>
              <span className="text-[10px] text-green-600 mt-1 block">▲ +4.2% dividend yield</span>
            </div>

            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Collected Funds (Actual)</span>
              <span className="text-lg font-bold text-gray-900 mt-1 block">₹3,45,000</span>
              <span className="text-[10px] text-gray-500 mt-1 block">Target baseline: ₹5,00,000</span>
            </div>

            <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Total Outstanding Dues</span>
              <span className="text-lg font-bold text-amber-600 mt-1 block">₹1,55,000</span>
              <span className="text-[10px] text-gray-500 mt-1 block">5 pending subscribers</span>
            </div>
          </div>

        </div>
      );

    case 'chits':
      return (
        <div className="space-y-6">
          
          {/* Toggle showing the Setup Wizard vs Card Directory */}
          {!showWizard ? (
            /* DIRECTORY VIEW */
            <div className="space-y-4 animate-in fade-in duration-200">
              
               {/* Summary Header banner */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900">Chit Groups Directory</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Active Groups: <strong className="text-gray-700">{localGroups.filter(g => g.active).length}</strong> | Total Value Managed: <strong className="text-indigo-600">{formatCurrency(localGroups.reduce((acc, g) => acc + g.totalValue, 0))}</strong>
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setShowWizard(true)}
                    className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow"
                  >
                    + New Group
                  </button>
                </div>
              </div>

              {/* Filter Actions row */}
              <div className="flex gap-2">
                <button
                  onClick={() => setGroupFilter('active')}
                  className={`text-[10px] font-bold px-3.5 py-1.5 rounded-lg border transition-all ${
                    groupFilter === 'active'
                      ? 'bg-indigo-50 text-indigo-600 border-indigo-150'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Active Only
                </button>
                <button
                  onClick={() => setGroupFilter('all')}
                  className={`text-[10px] font-bold px-3.5 py-1.5 rounded-lg border transition-all ${
                    groupFilter === 'all'
                      ? 'bg-indigo-50 text-indigo-600 border-indigo-150'
                      : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900'
                  }`}
                >
                  Show All
                </button>
              </div>

              {/* Groups Card Directory Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {localGroups.filter(g => groupFilter === 'all' || g.active).length === 0 ? (
                  <div className="col-span-full py-12 px-6 bg-white border border-gray-200 rounded-xl text-center flex flex-col items-center justify-center space-y-3 shadow-sm">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Briefcase size={24} />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-gray-900">No Chit Groups Created Yet</h4>
                      <p className="text-xs text-gray-500 max-w-sm">
                        Start by creating your first chit group and enrolling members to track monthly auctions and treasury collections.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowWizard(true)}
                      className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-4 py-2 rounded-lg transition-colors shadow"
                    >
                      + Create First Group
                    </button>
                  </div>
                ) : (
                localGroups
                  .filter(g => groupFilter === 'all' || g.active)
                  .map((g) => {
                    const progressPercent = (g.currentMonth / g.duration) * 100;
                    
                    return (
                      <div key={g.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm hover:border-gray-300 transition-colors flex flex-col justify-between">
                        <div className="space-y-3">
                          {/* Card Top */}
                          <div className="flex justify-between items-start">
                            <div className="flex items-center space-x-2">
                              {/* Green Indicator Dot */}
                              <span className={`w-2 h-2 rounded-full shrink-0 ${g.active ? 'bg-green-500 animate-pulse' : 'bg-gray-350'}`}></span>
                              <h4 className="text-xs font-bold text-gray-900 truncate max-w-[140px]">{g.name}</h4>
                            </div>

                            {/* Editable Icon Placeholder */}
                            <div className="p-1 rounded bg-gray-100 text-gray-500">
                              <Briefcase size={12} />
                            </div>
                          </div>

                          {/* Horizontal Progress bar — or Launch Month badge */}
                          {g.currentMonth === 0 ? (
                            <div className="flex items-center gap-2 py-1">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                              <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Launch Month — Company Profit Phase</span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                                <span>Progress</span>
                                <span>Month {g.currentMonth} of {g.duration}</span>
                              </div>
                              <div className="w-full bg-gray-105 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-indigo-650 h-full rounded-full transition-all duration-350"
                                  style={{ width: `${progressPercent}%` }}
                                ></div>
                              </div>
                            </div>
                          )}

                          {/* Metadata Tracks */}
                          <div className="space-y-1.5 text-[10px] text-gray-500">
                            <div className="flex justify-between">
                              <span>Total Pool:</span>
                              <strong className="text-gray-700">{formatCurrency(g.totalValue)}</strong>
                            </div>
                            <div className="flex justify-between">
                              <span>Monthly Installment:</span>
                              <strong className="text-indigo-600">{formatCurrency(g.totalValue / g.duration)}</strong>
                            </div>
                            {g.currentMonth === 0 && (
                              <div className="flex justify-between">
                                <span>Launch Profit:</span>
                                <strong className="text-amber-600">{formatCurrency(g.totalValue)}</strong>
                              </div>
                            )}
                            {(() => {
                              const { display, isOverride } = getGroupAuctionDate(g.id);
                              return (
                                <div className="flex justify-between items-center">
                                  <span>Auction Date:</span>
                                  <div className="flex items-center gap-1">
                                    <strong className={isOverride ? 'text-amber-600' : 'text-gray-700'}>{display}</strong>
                                    <button
                                      onClick={() => { setRescheduleGroupId(g.id); setRescheduleInputVal(auctionDateOverrides[g.id] || ''); }}
                                      className="text-[8px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 px-1 py-0.5 rounded hover:bg-indigo-100 transition-colors"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Footer Split Button containers */}
                        {g.currentMonth === 0 ? (
                          // Month-0 Launch: show a single Confirm Launch CTA spanning full width
                          <div className="pt-3 border-t border-gray-100">
                            <button
                              onClick={() => {
                                setLocalGroups(prev => prev.map(grp =>
                                  grp.id === g.id ? { ...grp, currentMonth: 1 } : grp
                                ));
                                const now = new Date();
                                const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                                setAuditLogs(prev => [
                                  {
                                    timestamp: `Today, ${timeStr}`,
                                    table: 'chit_groups',
                                    desc: `LAUNCH CONFIRMED for "${g.name}" — ₹${g.totalValue.toLocaleString('en-IN')} locked as company profit. Group advanced to Month 1.`,
                                    executor: 'Kishor (Admin)'
                                  },
                                  ...prev
                                ]);
                                alert(`✅ Launch confirmed! ₹${g.totalValue.toLocaleString('en-IN')} locked as company profit for Month 0. Group now advances to Month 1.`);
                              }}
                              className="w-full bg-amber-600 hover:bg-amber-755 text-white font-bold text-[10px] py-2 rounded flex items-center justify-center gap-1.5 transition-all shadow-sm"
                            >
                              <Rocket size={12} /> Confirm Launch &amp; Roll to Month 1
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => alert(`Opening workspace dashboard for Chit Group: ${g.name}...`)}
                              className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-[10px] py-1.5 rounded transition-all"
                            >
                              Dashboard
                            </button>
                            <button
                              onClick={() => {
                                const copy = {
                                  ...g,
                                  id: Math.random().toString(),
                                  name: `${g.name} (Copy)`
                                };
                                setLocalGroups(prev => [copy, ...prev]);
                                alert(`Chit Group template "${g.name}" duplicated successfully!`);
                              }}
                              className="bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 font-bold text-[10px] py-1.5 rounded transition-all"
                            >
                              Duplicate
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* SETUP WIZARD VIEW */
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Setup Wizard Progress Indicator */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Chit Setup Wizard</h3>
                  <button
                    onClick={() => setShowWizard(false)}
                    className="text-[10px] text-gray-500 hover:text-gray-900 underline font-semibold ml-2"
                  >
                    Cancel Wizard
                  </button>
                </div>
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 1 
                        ? 'bg-gray-900 text-white shadow shadow-black/30' 
                        : wizardStep > 1 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      {wizardStep > 1 ? <Check size={12} /> : '1'}
                    </span>
                    <span className={`text-xs font-semibold ${wizardStep === 1 ? 'text-gray-900' : 'text-gray-400'}`}>Basic Info</span>
                  </div>
                  
                  <div className="w-8 h-px bg-gray-200"></div>

                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 2 
                        ? 'bg-gray-900 text-white shadow shadow-black/30' 
                        : wizardStep > 2 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                          : 'bg-gray-100 text-gray-400'
                    }`}>
                      {wizardStep > 2 ? <Check size={12} /> : '2'}
                    </span>
                    <span className={`text-xs font-semibold ${wizardStep === 2 ? 'text-gray-900' : 'text-gray-400'}`}>Assign Members</span>
                  </div>

                  <div className="w-8 h-px bg-gray-200"></div>

                  <div className="flex items-center space-x-2">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      wizardStep === 3 
                        ? 'bg-gray-900 text-white shadow shadow-black/30' 
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      3
                    </span>
                    <span className={`text-xs font-semibold ${wizardStep === 3 ? 'text-gray-900' : 'text-gray-400'}`}>Monthly Plan</span>
                  </div>
                </div>
              </div>

              {/* STEP 1: BASIC INFO */}
              {wizardStep === 1 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-5 shadow-sm">
                  <div className="border-b border-gray-150 pb-3">
                    <h4 className="text-sm font-bold text-gray-900">Step 1: Basic Information</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Define name, monthly pool targets, and chit duration</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Group Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. G-Elite-Weekly-301"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Total Pool Value (₹)</label>
                      <input
                        type="number"
                        required
                        placeholder="e.g. 100000"
                        value={newGroupValue}
                        onChange={(e) => setNewGroupValue(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none"
                      />
                      {/* Target Presets */}
                      <div className="flex gap-1.5 mt-1.5">
                        {[{ label: '₹1L', val: 100000 }, { label: '₹2L', val: 200000 }, { label: '₹5L', val: 500000 }, { label: '₹10L', val: 1000000 }].map(preset => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setNewGroupValue(preset.val.toString())}
                            className="bg-gray-55 hover:bg-gray-105 border border-gray-200 text-[9px] text-gray-600 font-bold px-2 py-1 rounded transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Duration / Member Count (Months)</label>
                      <input
                        type="number"
                        required
                        min={1}
                        max={50}
                        placeholder="e.g. 20"
                        value={newGroupDuration}
                        onChange={(e) => handleDurationChange(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-lg px-3 py-2 text-xs text-gray-900 focus:outline-none"
                      />
                      {/* Duration Presets */}
                      <div className="flex gap-1.5 mt-1.5">
                        {[10, 20, 25, 50].map(val => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => handleDurationChange(val.toString())}
                            className="bg-gray-55 hover:bg-gray-105 border border-gray-200 text-[9px] text-gray-600 font-bold px-2.5 py-1 rounded transition-colors"
                          >
                            {val}m
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4 border-t border-gray-150">
                    <button
                      type="button"
                      disabled={!newGroupName.trim() || !newGroupValue || !newGroupDuration}
                      onClick={() => setWizardStep(2)}
                      className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow"
                    >
                      Next: Assign Members <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: ASSIGN MEMBERS */}
              {wizardStep === 2 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-6 shadow-sm">
                  <div className="border-b border-gray-150 pb-3 flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-bold text-gray-900">Step 2: Assign Group Members</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Click master directory members below to enroll them in spots</p>
                    </div>
                    <span className="bg-indigo-50 text-indigo-600 border border-indigo-150 text-[10px] font-bold px-3 py-1 rounded">
                      Enrolled: {enrollments.filter(e => e.name !== '').length} / {newGroupDuration} spots
                    </span>
                  </div>

                  {/* Slots Grid */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Group Enrollment Spots</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[220px] overflow-y-auto pr-1">
                      {enrollments.map((slot, index) => (
                        <div key={index} className={`flex gap-2 items-center p-2.5 rounded-lg border transition-all ${
                          slot.name 
                            ? 'bg-gray-50 border-gray-200' 
                            : 'border-dashed border-gray-200 bg-white'
                        }`}>
                          <span className="text-[10px] font-bold text-gray-400 shrink-0">#{index + 1}</span>
                          {slot.name ? (
                            <div className="flex-1 min-w-0 flex items-center justify-between">
                              <div className="truncate">
                                <span className="text-xs font-bold text-gray-800 block truncate">{slot.name}</span>
                                <span className="text-[9px] text-gray-400 mt-0.5">{slot.phone}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleEnrollmentChange(index, 'name', '')}
                                className="text-red-650 hover:text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-red-200 shrink-0 bg-white"
                              >
                                Clear
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300 font-semibold italic">Empty slot</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Master Member Directory */}
                  <div className="space-y-3 border-t border-gray-150 pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <h5 className="text-[10px] font-bold text-indigo-650 uppercase tracking-wider">Master Subscriber Directory</h5>
                      <div className="relative w-full sm:w-64">
                        <span className="absolute left-2.5 top-1.5 text-gray-400"><Search size={14} /></span>
                        <input
                          type="text"
                          placeholder="Search subscribers..."
                          value={memberSearchQuery}
                          onChange={(e) => setMemberSearchQuery(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded px-8 py-1 text-xs text-gray-900 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[160px] overflow-y-auto pr-1">
                      {masterDirectory
                        .filter(m => m.name.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                        .map((member, i) => {
                          const isAlreadyAdded = enrollments.some(e => e.name === member.name);

                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={isAlreadyAdded}
                              onClick={() => {
                                const firstEmptyIndex = enrollments.findIndex(e => e.name === '');
                                if (firstEmptyIndex !== -1) {
                                  setEnrollments(prev => {
                                    const copy = [...prev];
                                    copy[firstEmptyIndex] = member;
                                    return copy;
                                  });
                                } else {
                                  alert("All spots are fully enrolled! To enroll more, increase group duration in Step 1.");
                                }
                              }}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                isAlreadyAdded 
                                  ? 'bg-gray-50 border-gray-200 opacity-40 cursor-not-allowed' 
                                  : 'bg-white hover:bg-gray-50 border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <span className="text-xs font-bold text-gray-800 block truncate">{member.name}</span>
                              <span className="text-[9px] text-gray-405 mt-0.5 block truncate">{member.phone}</span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 border-t border-gray-150">
                    <button
                      type="button"
                      onClick={() => setWizardStep(1)}
                      className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={enrollments.some(e => e.name === '')}
                      onClick={() => setWizardStep(3)}
                      className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-1.5 shadow"
                    >
                      Next: Monthly Plan <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: MONTHLY PLAN REVIEW */}
              {wizardStep === 3 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-6 shadow-sm">
                  <div className="border-b border-gray-150 pb-3">
                    <h4 className="text-sm font-bold text-gray-900">Step 3: Review Monthly Plan</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Verify baseline payments and member lists before finalizing</p>
                  </div>

                  {/* Review Summary Details Card */}
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-gray-400 block">Group Name</span>
                        <strong className="text-gray-800 mt-1 block">{newGroupName}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Chit Value (Pool)</span>
                        <strong className="text-indigo-650 mt-1 block">{formatCurrency(Number(newGroupValue))}</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Member spots / Duration</span>
                        <strong className="text-gray-800 mt-1 block">{newGroupDuration} months</strong>
                      </div>
                      <div>
                        <span className="text-gray-400 block">Baseline Fixed Monthly Due</span>
                        <strong className="text-emerald-700 mt-1 block">
                          {formatCurrency(Number(newGroupValue) / Number(newGroupDuration))}/member
                        </strong>
                      </div>
                    </div>

                    <div className="border-t border-gray-150 pt-3">
                      <span className="text-[10px] font-bold text-gray-550 uppercase tracking-wider block mb-2">Enrolled Subscribers</span>
                      <div className="flex flex-wrap gap-2">
                        {enrollments.map((slot, index) => (
                          <span key={index} className="bg-white border border-gray-200 text-[10px] text-gray-700 px-2.5 py-1 rounded shadow-sm">
                            Ticket #{index + 1}: {slot.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4 border-t border-gray-150">
                    <button
                      type="button"
                      onClick={() => setWizardStep(2)}
                      className="border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold text-xs px-4 py-2.5 rounded-lg transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateGroup}
                      className="bg-gray-900 hover:bg-black text-white font-bold text-xs px-6 py-2.5 rounded-lg transition-colors duration-155 flex items-center justify-center gap-1.5 shadow"
                    >
                      Create Group & Enroll Slots
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      );

    default:
      return null;
  }
}
