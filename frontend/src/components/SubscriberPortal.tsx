'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import FontSizeSwitcher from '@/components/FontSizeSwitcher';
import { 
  Ticket, 
  Wallet, 
  Trophy, 
  Sparkles, 
  History, 
  QrCode, 
  LogOut, 
  RefreshCw, 
  CheckCircle2, 
  ChevronRight, 
  FileText, 
  Layers,
  ShieldCheck,
  ArrowDownLeft,
  Calendar,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import QRCode from 'qrcode';

interface EnrolledGroup {
  groupId: string;
  groupName: string;
  totalValue: number;
  memberCount: number;
  durationMonths: number;
  currentMonth: number;
  kaiIruppuPool: number;
  status: string;
  startDate: string;
  ticketNumber: number;
  hasWonRegular: boolean;
  physicalBookSynced: boolean;
  monthlyInstallment: number;
}

interface SubscriberTransaction {
  id: string;
  groupId: string;
  groupName: string;
  type: string;
  amount: number;
  walletType: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

interface GroupAuction {
  id: string;
  groupId: string;
  groupName: string;
  month: number;
  winningDiscount: number;
  winnerId: string;
  winnerName: string;
  isLaabaSeetu: boolean;
  createdAt: string;
  netPayout: number;
  isCurrentSubscriberWinner: boolean;
}

export default function SubscriberPortal() {
  const { profile, signOut } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'chits' | 'passbook' | 'auctions' | 'qr'>('overview');
  
  const [groups, setGroups] = useState<EnrolledGroup[]>([]);
  const [transactions, setTransactions] = useState<SubscriberTransaction[]>([]);
  const [auctions, setAuctions] = useState<GroupAuction[]>([]);
  const [selectedTx, setSelectedTx] = useState<SubscriberTransaction | null>(null);

  // Digital QR Passbook Data URL & Copied State
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const loadSubscriberData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase.rpc('get_subscriber_portal_data', {
        p_profile_id: profile.id,
      });

      if (error) {
        console.error('Failed to load subscriber portal data:', error);
        return;
      }

      if (data?.success) {
        setGroups(data.groups || []);
        setTransactions(data.transactions || []);
        setAuctions(data.auctions || []);
      }
    } catch (err) {
      console.error('Error in subscriber data fetching:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    loadSubscriberData();
  }, [loadSubscriberData]);

  // Generate QR Passbook image
  useEffect(() => {
    if (profile?.passbookToken || profile?.id) {
      const qrPayload = profile.passbookToken 
        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/passbook?token=${profile.passbookToken}`
        : `CHIT_MEMBER:${profile.phoneNumber || profile.id}`;

      QRCode.toDataURL(qrPayload, {
        width: 360,
        margin: 1,
        color: {
          dark: '#090d16',
          light: '#ffffff',
        },
      }).then(setQrDataUrl).catch(console.error);
    }
  }, [profile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSubscriberData();
  };

  const handleCopyPassbookId = () => {
    const idToCopy = profile?.phoneNumber || profile?.id || '';
    if (idToCopy && typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(idToCopy);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // Portfolio Totals
  const totalPaid = transactions
    .filter(t => t.type === 'collection' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const wonGroupsCount = groups.filter(g => g.hasWonRegular).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white px-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium tracking-tight">Loading Member Passbook...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-24 md:pb-8 antialiased">
      
      {/* 1. TOP APP BAR (Compact & Clean on Mobile) */}
      <header className="sticky top-0 z-30 bg-[#0c1220]/95 backdrop-blur-md border-b border-slate-800/80 px-3.5 sm:px-6 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          
          {/* User Identity / Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-xs sm:text-sm shrink-0 shadow-md shadow-indigo-600/25">
              {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : 'M'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-sm text-white truncate">
                  {profile?.fullName || 'Subscriber'}
                </span>
                <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                  Member
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono truncate">{profile?.phoneNumber || 'Active'}</p>
            </div>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <FontSizeSwitcher />
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh"
              aria-label="Refresh"
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1 active:scale-95"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
              <span className="hidden sm:inline text-[11px] font-semibold">Refresh</span>
            </button>

            <button
              onClick={signOut}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all text-xs flex items-center gap-1 active:scale-95 font-semibold"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline text-[11px]">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-5xl w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 flex-1">
        
        {/* HERO WELCOME & PORTFOLIO SNAPSHOT (Zero horizontal spill) */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-500/20 p-4 sm:p-6 shadow-xl">
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-indigo-400 text-[10px] font-bold uppercase tracking-wider mb-0.5">
                <ShieldCheck size={13} className="shrink-0" /> Official Chit Passbook
              </div>
              <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight truncate">
                வணக்கம், {profile?.fullName?.split(' ')[0] || 'Member'}!
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5 max-w-md line-clamp-1 sm:line-clamp-none">
                Live dues, auction schedule, and Laaba Seetu tracker.
              </p>
            </div>

            {/* Quick QR Passbook Trigger */}
            <button
              onClick={() => setActiveTab('qr')}
              className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-[11px] sm:text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/30 shrink-0"
            >
              <QrCode size={14} />
              <span className="whitespace-nowrap">QR Pass</span>
            </button>
          </div>

          {/* 4-METRIC GRID (Optimized for 2-column mobile screens without text wrap) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3.5 mt-4">
            
            {/* Stat 1: Total Contributed */}
            <div className="bg-[#070b14]/80 backdrop-blur-sm border border-slate-800/90 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-semibold truncate">Total Paid</span>
                <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 shrink-0">
                  <Wallet size={13} />
                </div>
              </div>
              <div className="text-base sm:text-xl font-black text-emerald-400 font-mono tracking-tight whitespace-nowrap">
                ₹{totalPaid.toLocaleString('en-IN')}
              </div>
              <p className="text-[9px] text-slate-500 mt-0.5 truncate">Across collections</p>
            </div>

            {/* Stat 2: Enrolled Tickets */}
            <div className="bg-[#070b14]/80 backdrop-blur-sm border border-slate-800/90 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-semibold truncate">Enrolled Chits</span>
                <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400 shrink-0">
                  <Ticket size={13} />
                </div>
              </div>
              <div className="text-base sm:text-xl font-black text-white font-mono tracking-tight whitespace-nowrap">
                {groups.length} <span className="text-[11px] font-normal text-slate-400">Tickets</span>
              </div>
              <p className="text-[9px] text-slate-500 mt-0.5 truncate">
                {groups.map(g => `#${g.ticketNumber}`).join(', ') || 'No tickets'}
              </p>
            </div>

            {/* Stat 3: Auction Status */}
            <div className="bg-[#070b14]/80 backdrop-blur-sm border border-slate-800/90 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-semibold truncate">Auction Status</span>
                <div className="p-1 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
                  <Trophy size={13} />
                </div>
              </div>
              <div className="text-base sm:text-xl font-black font-mono tracking-tight whitespace-nowrap">
                {wonGroupsCount > 0 ? (
                  <span className="text-amber-400">{wonGroupsCount} Won</span>
                ) : (
                  <span className="text-indigo-400">Eligible</span>
                )}
              </div>
              <p className="text-[9px] text-slate-500 mt-0.5 truncate">
                {wonGroupsCount > 0 ? 'Prize Pot disbursed' : 'Eligible for bidding'}
              </p>
            </div>

            {/* Stat 4: Sync Status */}
            <div className="bg-[#070b14]/80 backdrop-blur-sm border border-slate-800/90 rounded-xl p-2.5 sm:p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-semibold truncate">Passbook Sync</span>
                <div className="p-1 rounded-md bg-violet-500/10 text-violet-400 shrink-0">
                  <FileText size={13} />
                </div>
              </div>
              <div className="text-base sm:text-xl font-black text-white font-mono tracking-tight flex items-center gap-1 whitespace-nowrap">
                <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                <span>Synced</span>
              </div>
              <p className="text-[9px] text-slate-500 mt-0.5 truncate">Counter & Digital</p>
            </div>

          </div>
        </div>

        {/* 3. DESKTOP TABS (Hidden on mobile, since Mobile Bottom Bar controls navigation) */}
        <div className="hidden md:flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers size={13} /> Overview
          </button>
          <button
            onClick={() => setActiveTab('chits')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'chits'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Ticket size={13} /> My Chits ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('passbook')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'passbook'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <History size={13} /> Passbook Ledger ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('auctions')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'auctions'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Trophy size={13} /> Auctions ({auctions.length})
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'qr'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <QrCode size={13} /> Passbook QR
          </button>
        </div>

        {/* 4. TAB CONTENTS */}

        {/* TAB 1: OVERVIEW & ACTIVE CHITS */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {groups.length === 0 ? (
              <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800 p-6">
                <Ticket className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                <h3 className="text-sm font-bold text-white">No Enrolled Chits Found</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                  You are not currently enrolled in any chit groups. Contact your Chit Fund Manager.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-0.5">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Ticket className="text-indigo-400" size={14} /> My Enrolled Groups ({groups.length})
                  </h2>
                </div>

                <div className="space-y-3">
                  {groups.map((grp) => {
                    const laabaProgress = Math.min(100, Math.round((grp.kaiIruppuPool / grp.totalValue) * 100));
                    const isLaabaReady = grp.kaiIruppuPool >= grp.totalValue;

                    return (
                      <div
                        key={grp.groupId}
                        className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-all rounded-2xl p-3.5 sm:p-5 shadow-lg space-y-3"
                      >
                        {/* Header: Name + Value */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-bold font-mono border border-indigo-500/20 mb-1">
                              Ticket #{grp.ticketNumber}
                            </div>
                            <h3 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                              {grp.groupName}
                            </h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {grp.durationMonths} Months • Current: <strong className="text-white font-mono">Month {grp.currentMonth}</strong>
                            </p>
                          </div>

                          <div className="text-right font-mono shrink-0">
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Chit Value</span>
                            <div className="text-sm sm:text-lg font-black text-emerald-400 whitespace-nowrap">
                              ₹{grp.totalValue.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        {/* 2-Column Key Metrics */}
                        <div className="grid grid-cols-2 gap-2 bg-[#080d17] p-2.5 rounded-xl border border-slate-800/80">
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Monthly Due</span>
                            <div className="text-xs sm:text-sm font-bold text-white font-mono mt-0.2 whitespace-nowrap">
                              ₹{grp.monthlyInstallment.toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 uppercase font-semibold">Auction Status</span>
                            <div className="text-xs sm:text-sm font-bold mt-0.2">
                              {grp.hasWonRegular ? (
                                <span className="text-amber-400 flex items-center gap-1 font-mono">
                                  <Trophy size={12} /> Won
                                </span>
                              ) : (
                                <span className="text-emerald-400 flex items-center gap-1 font-mono">
                                  <CheckCircle2 size={12} /> Eligible
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Laaba Seetu Progress Box */}
                        <div className="bg-gradient-to-r from-violet-950/40 to-indigo-950/40 border border-violet-500/20 rounded-xl p-2.5 sm:p-3">
                          <div className="flex items-center justify-between text-[10px] sm:text-xs mb-1.5">
                            <span className="font-bold text-violet-300 flex items-center gap-1 truncate">
                              <Sparkles size={12} className="text-violet-400 shrink-0" />
                              <span>லாப சீட்டு (Laaba Seetu)</span>
                            </span>
                            <span className="font-mono text-white font-bold whitespace-nowrap text-[10px] sm:text-xs">
                              ₹{grp.kaiIruppuPool.toLocaleString('en-IN')} / ₹{grp.totalValue.toLocaleString('en-IN')}
                            </span>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isLaabaReady
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : 'bg-gradient-to-r from-violet-500 to-indigo-500'
                              }`}
                              style={{ width: `${Math.max(4, laabaProgress)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[9px] text-slate-400 mt-1.5">
                            <span>{isLaabaReady ? '🎉 Target reached! Next month is FREE' : `${laabaProgress}% towards ₹0 Free Month`}</span>
                            <span className="font-mono text-violet-300 font-bold">{laabaProgress}%</span>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="grid grid-cols-2 gap-2 pt-0.5">
                          <button
                            onClick={() => setActiveTab('passbook')}
                            className="py-2 px-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95"
                          >
                            <FileText size={12} /> Passbook
                          </button>
                          <button
                            onClick={() => setActiveTab('auctions')}
                            className="py-2 px-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all flex items-center justify-center gap-1 active:scale-95 shadow-sm shadow-indigo-600/30"
                          >
                            <Trophy size={12} /> Auctions
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RECENT PASSBOOK TRANSACTIONS (Mobile-Native List) */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 sm:p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="text-indigo-400" size={13} /> Recent Collections ({transactions.length})
                </h3>
                <button
                  onClick={() => setActiveTab('passbook')}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-0.5"
                >
                  View All <ChevronRight size={13} />
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-[11px]">
                  No verified collection receipts yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {transactions.slice(0, 4).map((tx) => (
                    <div 
                      key={tx.id} 
                      onClick={() => setSelectedTx(tx)}
                      className="py-2.5 flex items-center justify-between gap-2.5 cursor-pointer hover:bg-slate-800/40 rounded-lg px-1 transition-all active:scale-[0.99]"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <ArrowDownLeft size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">{tx.groupName}</div>
                          <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.2">
                            <span>
                              {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                            <span>•</span>
                            <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                              {tx.walletType.replace(/_/g, ' ')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono shrink-0">
                        <div className="text-xs font-black text-emerald-400">
                          +₹{Number(tx.amount).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[9px] uppercase font-bold text-slate-500">
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ENROLLED CHITS FULL VIEW */}
        {activeTab === 'chits' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-0.5">
              <Ticket className="text-indigo-400" size={14} /> All Enrolled Chit Tickets ({groups.length})
            </h2>

            <div className="space-y-3">
              {groups.map((grp) => (
                <div
                  key={grp.groupId}
                  className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3.5 sm:p-5 shadow-lg space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-bold font-mono border border-indigo-500/20 mb-1">
                        Ticket #{grp.ticketNumber}
                      </span>
                      <h3 className="text-sm sm:text-base font-black text-white">{grp.groupName}</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {grp.durationMonths} Months Duration • {grp.memberCount} Members
                      </p>
                    </div>

                    <div className="text-right font-mono shrink-0 bg-[#080d17] p-2 rounded-xl border border-slate-800">
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Value</span>
                      <div className="text-sm font-black text-emerald-400 whitespace-nowrap">
                        ₹{grp.totalValue.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-[#080d17] p-2.5 rounded-xl border border-slate-800/80">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Monthly Due</span>
                      <div className="text-xs font-bold text-white font-mono mt-0.2 whitespace-nowrap">
                        ₹{grp.monthlyInstallment.toLocaleString('en-IN')}
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">Current Month</span>
                      <div className="text-xs font-bold text-white font-mono mt-0.2">
                        Month {grp.currentMonth} of {grp.durationMonths}
                      </div>
                    </div>
                  </div>

                  {/* Rules Summary Card */}
                  <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-[11px] text-slate-300 space-y-1">
                    <div className="font-bold text-indigo-300 flex items-center gap-1 text-[11px]">
                      <Sparkles size={13} /> Key Group Parameters
                    </div>
                    <p className="text-[10px] text-slate-400">
                      • Month 0: Organizer Profit (₹{grp.totalValue.toLocaleString('en-IN')})<br />
                      • Months 1 to {grp.durationMonths}: Monthly Live Auctions<br />
                      • Laaba Seetu: ₹0 Free Installment when pool reaches ₹{grp.totalValue.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PASSBOOK LEDGER (Mobile-Optimized Cards & Filter) */}
        {activeTab === 'passbook' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-0.5">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="text-indigo-400" size={14} /> Official Member Passbook
                </h2>
              </div>
              <div className="text-right font-mono shrink-0">
                <span className="text-[9px] text-slate-400 uppercase">Verified Sum: </span>
                <span className="text-xs font-black text-emerald-400">₹{totalPaid.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800 p-6">
                <FileText className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                <h3 className="text-sm font-bold text-white">No Passbook Entries Recorded</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                  Once your installments are recorded by the counter manager, entries will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 transition-all rounded-xl p-3 shadow-md flex items-center justify-between gap-2.5 cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{tx.groupName}</div>
                        <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                          <span>
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span>•</span>
                          <span className="uppercase text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                            {tx.walletType.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono shrink-0">
                      <div className="text-sm font-black text-emerald-400">
                        +₹{Number(tx.amount).toLocaleString('en-IN')}
                      </div>
                      <span className="text-[9px] uppercase font-bold text-slate-500">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AUCTIONS & BIDDING STUDIO */}
        {activeTab === 'auctions' && (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 px-0.5">
              <Trophy className="text-indigo-400" size={14} /> Group Auction History ({auctions.length})
            </h2>

            {auctions.length === 0 ? (
              <div className="text-center py-10 bg-slate-900/60 rounded-2xl border border-slate-800 p-6">
                <Trophy className="mx-auto h-10 w-10 text-slate-600 mb-2" />
                <h3 className="text-sm font-bold text-white">No Auction Rounds Conducted Yet</h3>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-1">
                  Starting Month 1, live bidding discounts and winner announcements will be published here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {auctions.map((auc) => (
                  <div
                    key={auc.id}
                    className={`rounded-2xl p-3.5 sm:p-5 border transition-all shadow-lg space-y-2.5 ${
                      auc.isCurrentSubscriberWinner
                        ? 'bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border-amber-500/40'
                        : 'bg-slate-900/90 border-slate-800/90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] font-bold font-mono border border-indigo-500/20 mb-1">
                          Month {auc.month} Auction
                        </span>
                        <h3 className="text-xs sm:text-sm font-black text-white truncate">{auc.groupName}</h3>
                        <p className="text-[10px] text-slate-400">
                          {new Date(auc.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>

                      {auc.isLaabaSeetu && (
                        <span className="px-2 py-0.5 rounded-md bg-violet-500/20 text-violet-300 text-[10px] font-bold border border-violet-500/30 shrink-0">
                          🎉 Laaba Seetu
                        </span>
                      )}
                    </div>

                    {/* Breakdown */}
                    <div className="bg-[#080d17] rounded-xl p-2.5 border border-slate-800 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Winner</span>
                        <span className="text-[11px] font-bold text-white flex items-center gap-1">
                          <Trophy size={12} className="text-amber-400" />
                          {auc.winnerName} {auc.isCurrentSubscriberWinner && '(You!)'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Winning Discount</span>
                        <span className="text-[11px] font-mono font-bold text-rose-400">
                          -₹{Number(auc.winningDiscount).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-indigo-300">Winner Net Payout</span>
                        <span className="text-xs sm:text-sm font-mono font-black text-emerald-400">
                          ₹{Number(auc.netPayout).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: DIGITAL PASSBOOK QR */}
        {activeTab === 'qr' && (
          <div className="max-w-sm mx-auto space-y-3.5 px-0.5">
            <div className="text-center">
              <h2 className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                <QrCode className="text-indigo-400" size={16} /> Official Digital Passbook QR
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Show this QR at the counter for physical book sync & payments.
              </p>
            </div>

            <div className="bg-white text-slate-950 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col items-center justify-center text-center space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold font-mono">
                Member ID: {profile?.phoneNumber || profile?.id?.slice(0, 8)}
              </div>

              {qrDataUrl ? (
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="Subscriber Passbook QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 mx-auto object-contain"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 text-xs">
                  Generating QR...
                </div>
              )}

              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">{profile?.fullName}</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.2">{profile?.phoneNumber}</p>
              </div>

              <div className="w-full pt-2.5 border-t border-slate-100 text-left space-y-1 text-[11px] text-slate-600">
                <div className="flex justify-between font-mono">
                  <span>Enrolled Chits:</span>
                  <span className="font-bold text-slate-900">{groups.length} Groups</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>Total Contributed:</span>
                  <span className="font-bold text-emerald-600">₹{totalPaid.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <button
                onClick={handleCopyPassbookId}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
              >
                {copiedId ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedId ? 'Copied Member ID!' : 'Copy Member ID'}</span>
              </button>
            </div>
          </div>
        )}

      </main>

      {/* 5. TRANSACTION DETAIL POPUP MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <FileText size={15} className="text-indigo-400" /> Receipt Details
              </h3>
              <button
                onClick={() => setSelectedTx(null)}
                className="text-xs text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Chit Group:</span>
                <span className="font-bold text-white">{selectedTx.groupName}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-400">Paid Amount:</span>
                <span className="font-black text-emerald-400 text-sm">₹{Number(selectedTx.amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Mode:</span>
                <span className="uppercase font-mono text-white">{selectedTx.walletType.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date:</span>
                <span className="font-mono text-white">{new Date(selectedTx.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status:</span>
                <span className="text-emerald-400 font-bold uppercase">{selectedTx.status}</span>
              </div>
              {selectedTx.notes && (
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-300">
                  <span className="text-slate-400 block mb-0.5">Notes:</span>
                  {selectedTx.notes}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedTx(null)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 6. FIXED MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0c1220]/95 backdrop-blur-lg border-t border-slate-800/90 px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center gap-0.5 text-[9px] font-bold p-1 rounded-xl transition-all ${
            activeTab === 'overview' ? 'text-indigo-400 scale-105' : 'text-slate-400'
          }`}
        >
          <Layers size={17} />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('chits')}
          className={`flex flex-col items-center gap-0.5 text-[9px] font-bold p-1 rounded-xl transition-all ${
            activeTab === 'chits' ? 'text-indigo-400 scale-105' : 'text-slate-400'
          }`}
        >
          <Ticket size={17} />
          <span>My Chits</span>
        </button>

        <button
          onClick={() => setActiveTab('passbook')}
          className={`flex flex-col items-center gap-0.5 text-[9px] font-bold p-1 rounded-xl transition-all ${
            activeTab === 'passbook' ? 'text-indigo-400 scale-105' : 'text-slate-400'
          }`}
        >
          <History size={17} />
          <span>Passbook</span>
        </button>

        <button
          onClick={() => setActiveTab('auctions')}
          className={`flex flex-col items-center gap-0.5 text-[9px] font-bold p-1 rounded-xl transition-all ${
            activeTab === 'auctions' ? 'text-indigo-400 scale-105' : 'text-slate-400'
          }`}
        >
          <Trophy size={17} />
          <span>Auctions</span>
        </button>

        <button
          onClick={() => setActiveTab('qr')}
          className={`flex flex-col items-center gap-0.5 text-[9px] font-bold p-1 rounded-xl transition-all ${
            activeTab === 'qr' ? 'text-indigo-400 scale-105' : 'text-slate-400'
          }`}
        >
          <QrCode size={17} />
          <span>QR Pass</span>
        </button>
      </nav>
    </div>
  );
}
