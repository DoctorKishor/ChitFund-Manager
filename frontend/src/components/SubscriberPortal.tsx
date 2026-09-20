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
  Clock, 
  ChevronRight, 
  TrendingUp, 
  FileText, 
  AlertCircle,
  Calendar,
  Layers,
  ArrowUpRight,
  Gift,
  ShieldCheck,
  UserCheck
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
  const [selectedGroup, setSelectedGroup] = useState<EnrolledGroup | null>(null);

  // Digital QR Passbook Data URL
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

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
        if (data.groups?.length > 0 && !selectedGroup) {
          setSelectedGroup(data.groups[0]);
        }
      }
    } catch (err) {
      console.error('Error in subscriber data fetching:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, selectedGroup]);

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
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      }).then(setQrDataUrl).catch(console.error);
    }
  }, [profile]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSubscriberData();
  };

  // Portfolio Totals
  const totalPaid = transactions
    .filter(t => t.type === 'collection' && t.status === 'completed')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const wonGroupsCount = groups.filter(g => g.hasWonRegular).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-medium">Loading your subscriber passbook...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white pb-24 md:pb-8">
      {/* 1. TOP HEADER & SUBSCRIBER IDENTITY */}
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center font-black text-white text-sm shadow-md shadow-indigo-600/30">
              CF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white tracking-tight">ChitFunds Passbook</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Subscriber
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">{profile?.phoneNumber || 'Member'}</p>
            </div>
          </div>

          {/* Right Header: Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <FontSizeSwitcher />
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              title="Refresh Data"
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5 active:scale-95"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin text-indigo-400' : ''} />
              <span className="hidden sm:inline text-xs font-semibold">Refresh</span>
            </button>

            <button
              onClick={signOut}
              title="Sign Out"
              className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all text-xs flex items-center gap-1.5 active:scale-95 font-semibold"
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. MAIN SUBSCRIBER CONTAINER */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1">
        
        {/* HERO WELCOME & PORTFOLIO SNAPSHOT */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-500/20 p-5 sm:p-7 shadow-2xl">
          <div className="absolute -top-16 -right-16 w-52 h-52 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-violet-500/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
                <ShieldCheck size={15} /> Verified Member Account
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                வணக்கம், {profile?.fullName || 'Subscriber'}!
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-lg">
                View your active chit tickets, monthly installment dues, accumulated Laaba Seetu pools, and live auction payouts.
              </p>
            </div>

            {/* Quick QR Passbook Trigger */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('qr')}
                className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2.5 transition-all shadow-lg shadow-indigo-600/30"
              >
                <QrCode size={18} />
                <span>My Passbook QR</span>
              </button>
            </div>
          </div>

          {/* PORTFOLIO STAT METRIC CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
            {/* Stat 1: Enrolled Chits */}
            <div className="bg-slate-950/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Enrolled Chits</span>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Ticket size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {groups.length} <span className="text-xs font-normal text-slate-400">Groups</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {groups.map(g => `Ticket #${g.ticketNumber}`).join(', ') || 'No tickets'}
              </p>
            </div>

            {/* Stat 2: Total Paid */}
            <div className="bg-slate-950/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Total Contributed</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Wallet size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                ₹{totalPaid.toLocaleString('en-IN')}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Across verified installments</p>
            </div>

            {/* Stat 3: Auction Status */}
            <div className="bg-slate-950/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Auction Status</span>
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <Trophy size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono">
                {wonGroupsCount > 0 ? (
                  <span className="text-amber-400 font-bold">{wonGroupsCount} Won</span>
                ) : (
                  <span className="text-indigo-400 font-bold">Eligible</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {wonGroupsCount > 0 ? 'Prize Pot disbursed' : 'Eligible for upcoming bidding'}
              </p>
            </div>

            {/* Stat 4: Sync Status */}
            <div className="bg-slate-950/60 backdrop-blur-sm border border-slate-800/80 rounded-2xl p-4">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Physical Passbook</span>
                <div className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
                  <FileText size={16} />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-black text-white font-mono flex items-center gap-1.5">
                <CheckCircle2 size={20} className="text-emerald-400" />
                <span>Synced</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Digital & Counter in sync</p>
            </div>
          </div>
        </div>

        {/* 3. NAVIGATION TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'overview'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Layers size={14} /> My Overview
          </button>
          <button
            onClick={() => setActiveTab('chits')}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'chits'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Ticket size={14} /> Enrolled Chits ({groups.length})
          </button>
          <button
            onClick={() => setActiveTab('passbook')}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'passbook'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <History size={14} /> Payment Ledger ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('auctions')}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'auctions'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Trophy size={14} /> Auction Studio ({auctions.length})
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              activeTab === 'qr'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <QrCode size={14} /> Digital Passbook QR
          </button>
        </div>

        {/* 4. TAB CONTENTS */}

        {/* TAB 1: OVERVIEW & CARDS */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {groups.length === 0 ? (
              <div className="text-center py-12 bg-slate-900 rounded-3xl border border-slate-800 p-8">
                <Ticket className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h3 className="text-base font-bold text-white">No Enrolled Chit Groups Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  You are not enrolled in any chit groups yet. Contact your Chit Fund Manager to assign your ticket.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Ticket className="text-indigo-400" size={18} /> Active Chit Subscriptions
                  </h2>
                  <span className="text-xs text-slate-400 font-mono">
                    {groups.length} active ticket{groups.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groups.map((grp) => {
                    const laabaProgress = Math.min(100, Math.round((grp.kaiIruppuPool / grp.totalValue) * 100));
                    const isLaabaReady = grp.kaiIruppuPool >= grp.totalValue;

                    return (
                      <div
                        key={grp.groupId}
                        className="bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col justify-between gap-5 relative overflow-hidden"
                      >
                        {/* Status tag */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-[11px] font-bold border border-indigo-500/20 mb-2 font-mono">
                              Ticket #{grp.ticketNumber}
                            </div>
                            <h3 className="text-lg font-black text-white tracking-tight">{grp.groupName}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {grp.durationMonths} Months Duration • Current: <span className="text-white font-bold font-mono">Month {grp.currentMonth}</span>
                            </p>
                          </div>

                          <div className="text-right font-mono">
                            <span className="text-xs text-slate-400">Chit Value</span>
                            <div className="text-xl font-black text-emerald-400">
                              ₹{grp.totalValue.toLocaleString('en-IN')}
                            </div>
                          </div>
                        </div>

                        {/* Middle metrics */}
                        <div className="grid grid-cols-2 gap-3 bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800/80">
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium">Monthly Installment</span>
                            <div className="text-sm font-bold text-white font-mono mt-0.5">
                              ₹{grp.monthlyInstallment.toLocaleString('en-IN')}
                            </div>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-medium">My Auction Status</span>
                            <div className="text-sm font-bold mt-0.5">
                              {grp.hasWonRegular ? (
                                <span className="text-amber-400 flex items-center gap-1 font-mono">
                                  <Trophy size={13} /> Won
                                </span>
                              ) : (
                                <span className="text-emerald-400 flex items-center gap-1 font-mono">
                                  <CheckCircle2 size={13} /> Eligible to Bid
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Laaba Seetu Progress Tracker */}
                        <div className="bg-gradient-to-r from-violet-950/40 to-indigo-950/40 border border-violet-500/20 rounded-2xl p-3.5">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="font-bold text-violet-300 flex items-center gap-1.5">
                              <Sparkles size={14} className="text-violet-400" />
                              லாப சீட்டு (Laaba Seetu Pool)
                            </span>
                            <span className="font-mono text-white font-bold">
                              ₹{grp.kaiIruppuPool.toLocaleString('en-IN')} / ₹{grp.totalValue.toLocaleString('en-IN')}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isLaabaReady
                                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                  : 'bg-gradient-to-r from-violet-500 to-indigo-500'
                              }`}
                              style={{ width: `${Math.max(5, laabaProgress)}%` }}
                            />
                          </div>

                          <p className="text-[10px] text-slate-400 mt-2">
                            {isLaabaReady ? (
                              <span className="text-emerald-400 font-bold">
                                🎉 Target reached! Next month is ₹0 FREE installment for all subscribers!
                              </span>
                            ) : (
                              <span>
                                Accumulated discount pool: <strong className="text-white font-mono">{laabaProgress}%</strong> towards next ₹0 Free Month.
                              </span>
                            )}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => {
                              setSelectedGroup(grp);
                              setActiveTab('passbook');
                            }}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                          >
                            <FileText size={14} /> View Passbook
                          </button>
                          <button
                            onClick={() => {
                              setSelectedGroup(grp);
                              setActiveTab('auctions');
                            }}
                            className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-indigo-600/20"
                          >
                            <Trophy size={14} /> Group Auctions
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RECENT PASSBOOK TRANSACTIONS SNIPPET */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="text-indigo-400" size={16} /> Recent Passbook Payments
                </h3>
                <button
                  onClick={() => setActiveTab('passbook')}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  View Full Ledger <ChevronRight size={14} />
                </button>
              </div>

              {transactions.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">
                  No payment transactions recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={16} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">{tx.groupName}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })} • Mode: <span className="uppercase font-mono">{tx.walletType.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono">
                        <div className="text-xs font-black text-emerald-400">
                          +₹{Number(tx.amount).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] uppercase font-bold text-slate-500">
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

        {/* TAB 2: ENROLLED CHITS VIEW */}
        {activeTab === 'chits' && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Ticket className="text-indigo-400" size={18} /> Detailed Chit Membership Schedule
            </h2>

            <div className="grid grid-cols-1 gap-6">
              {groups.map((grp) => (
                <div
                  key={grp.groupId}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-xl space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold font-mono border border-indigo-500/20 mb-2">
                        Ticket Number: #{grp.ticketNumber}
                      </div>
                      <h3 className="text-xl font-black text-white">{grp.groupName}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Started on {new Date(grp.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} • {grp.memberCount} Members
                      </p>
                    </div>

                    <div className="text-left sm:text-right font-mono bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <span className="text-[11px] text-slate-400">Total Group Value</span>
                      <div className="text-2xl font-black text-emerald-400">
                        ₹{grp.totalValue.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Group Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">Monthly Installment</span>
                      <div className="text-sm font-bold text-white font-mono mt-0.5">
                        ₹{grp.monthlyInstallment.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">Current Month</span>
                      <div className="text-sm font-bold text-white font-mono mt-0.5">
                        Month {grp.currentMonth} of {grp.durationMonths}
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">Bidding Eligibility</span>
                      <div className="text-sm font-bold mt-0.5 font-mono">
                        {grp.hasWonRegular ? (
                          <span className="text-amber-400">Prize Awarded</span>
                        ) : (
                          <span className="text-emerald-400">Eligible to Win</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 font-medium">Discount Pool</span>
                      <div className="text-sm font-bold text-violet-400 font-mono mt-0.5">
                        ₹{grp.kaiIruppuPool.toLocaleString('en-IN')}
                      </div>
                    </div>
                  </div>

                  {/* Business rules breakdown */}
                  <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs space-y-2">
                    <h4 className="font-bold text-indigo-300 flex items-center gap-1.5">
                      <Sparkles size={14} /> Chit Fund Schedule & Rule Overview
                    </h4>
                    <ul className="text-slate-300 text-[11px] space-y-1 list-disc list-inside">
                      <li><strong>Month 0 (Launch Month):</strong> Full collection pool allocated to Organizer Profit (No auction).</li>
                      <li><strong>Months 1 to {grp.durationMonths}:</strong> Regular monthly auctions. Winner Net Payout = ₹{grp.totalValue.toLocaleString('en-IN')} - Winning Discount Bid.</li>
                      <li><strong>Laaba Seetu (லாப சீட்டு):</strong> When the accumulated discount pool reaches ₹{grp.totalValue.toLocaleString('en-IN')}, that month's installment is completely <strong>FREE (₹0 Due)</strong> for all members!</li>
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: PASSBOOK LEDGER */}
        {activeTab === 'passbook' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <History className="text-indigo-400" size={18} /> Official Member Passbook Ledger
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete immutable collection transactions and verified counter entries.
                </p>
              </div>

              <div className="text-right font-mono bg-slate-900 px-4 py-2 rounded-2xl border border-slate-800">
                <span className="text-[10px] text-slate-400">Total Verified Payments</span>
                <div className="text-base font-black text-emerald-400">
                  ₹{totalPaid.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-12 bg-slate-900 rounded-3xl border border-slate-800 p-8">
                <FileText className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h3 className="text-base font-bold text-white">No Passbook Entries Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Once your payments are recorded and verified by the manager, receipt entries will appear here live.
                </p>
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                        <th className="py-3 px-4 font-semibold">Date & Time</th>
                        <th className="py-3 px-4 font-semibold">Chit Group</th>
                        <th className="py-3 px-4 font-semibold">Payment Mode</th>
                        <th className="py-3 px-4 font-semibold">Description / Notes</th>
                        <th className="py-3 px-4 font-semibold text-right">Amount</th>
                        <th className="py-3 px-4 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-sans">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono text-slate-300">
                            {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                            <div className="text-[10px] text-slate-500 font-mono">
                              {new Date(tx.createdAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {tx.groupName}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-300 uppercase text-[11px]">
                            {tx.walletType.replace(/_/g, ' ')}
                          </td>
                          <td className="py-3 px-4 text-slate-300 max-w-xs truncate text-[11px]">
                            {tx.notes || 'Monthly collection entry'}
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-emerald-400 text-right text-sm">
                            ₹{Number(tx.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-mono">
                              <CheckCircle2 size={11} /> {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: AUCTIONS & BIDDING STUDIO */}
        {activeTab === 'auctions' && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="text-indigo-400" size={18} /> Chit Group Auction Records & Payouts
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Transparent live bidding logs, winning discount records, and member net disbursements.
              </p>
            </div>

            {auctions.length === 0 ? (
              <div className="text-center py-12 bg-slate-900 rounded-3xl border border-slate-800 p-8">
                <Trophy className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h3 className="text-base font-bold text-white">No Auction Rounds Conducted Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Once the monthly auctions commence starting Month 1, all bidding discounts and winners will be published here transparently.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {auctions.map((auc) => (
                  <div
                    key={auc.id}
                    className={`rounded-3xl p-5 sm:p-6 border transition-all shadow-xl space-y-4 ${
                      auc.isCurrentSubscriberWinner
                        ? 'bg-gradient-to-br from-amber-950/50 via-slate-900 to-slate-900 border-amber-500/40 ring-1 ring-amber-500/30'
                        : 'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold font-mono border border-indigo-500/20 mb-1.5">
                          Month {auc.month} Auction Round
                        </span>
                        <h3 className="text-base font-black text-white">{auc.groupName}</h3>
                        <p className="text-[11px] text-slate-400">
                          {new Date(auc.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>

                      {auc.isLaabaSeetu && (
                        <span className="px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 text-[10px] font-bold border border-violet-500/30">
                          🎉 Laaba Seetu
                        </span>
                      )}
                    </div>

                    {/* Winner details */}
                    <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Winning Bidder</span>
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Trophy size={14} className="text-amber-400" />
                          {auc.winnerName} {auc.isCurrentSubscriberWinner && '(You!)'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">Winning Discount Bid</span>
                        <span className="text-xs font-mono font-bold text-rose-400">
                          -₹{Number(auc.winningDiscount).toLocaleString('en-IN')}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-semibold text-indigo-300">Winner Net Payout</span>
                        <span className="text-base font-mono font-black text-emerald-400">
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

        {/* TAB 5: DIGITAL PASSBOOK QR CARD */}
        {activeTab === 'qr' && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <QrCode className="text-indigo-400" size={20} /> Your Official Digital Passbook QR
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Show this QR code at the physical counter or auction room for instant passbook verification.
              </p>
            </div>

            <div className="bg-white text-slate-950 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center justify-center text-center space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold font-mono">
                Member ID: {profile?.phoneNumber || profile?.id?.slice(0, 8)}
              </div>

              {qrDataUrl ? (
                <div className="p-3 bg-white rounded-2xl border-2 border-slate-100 shadow-inner">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="Subscriber Passbook QR Code"
                    className="w-56 h-56 mx-auto object-contain"
                  />
                </div>
              ) : (
                <div className="w-56 h-56 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs">
                  Generating QR...
                </div>
              )}

              <div>
                <h3 className="text-xl font-black text-slate-900">{profile?.fullName}</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">{profile?.phoneNumber}</p>
              </div>

              <div className="w-full pt-3 border-t border-slate-100 text-left space-y-1 text-xs text-slate-600">
                <div className="flex justify-between font-mono">
                  <span>Enrolled Chits:</span>
                  <span className="font-bold text-slate-900">{groups.length} Groups</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span>Total Contributed:</span>
                  <span className="font-bold text-emerald-600">₹{totalPaid.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-center text-xs text-slate-400">
              🔒 <strong>High Trust Security:</strong> This QR token is tied securely to your member ledger.
            </div>
          </div>
        )}

      </main>

      {/* 5. MOBILE BOTTOM DEDICATED NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-3 py-2 flex items-center justify-around">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold p-1 rounded-xl ${
            activeTab === 'overview' ? 'text-indigo-400' : 'text-slate-400'
          }`}
        >
          <Layers size={18} />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('chits')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold p-1 rounded-xl ${
            activeTab === 'chits' ? 'text-indigo-400' : 'text-slate-400'
          }`}
        >
          <Ticket size={18} />
          <span>My Chits</span>
        </button>

        <button
          onClick={() => setActiveTab('passbook')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold p-1 rounded-xl ${
            activeTab === 'passbook' ? 'text-indigo-400' : 'text-slate-400'
          }`}
        >
          <History size={18} />
          <span>Passbook</span>
        </button>

        <button
          onClick={() => setActiveTab('auctions')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold p-1 rounded-xl ${
            activeTab === 'auctions' ? 'text-indigo-400' : 'text-slate-400'
          }`}
        >
          <Trophy size={18} />
          <span>Auctions</span>
        </button>

        <button
          onClick={() => setActiveTab('qr')}
          className={`flex flex-col items-center gap-1 text-[10px] font-bold p-1 rounded-xl ${
            activeTab === 'qr' ? 'text-indigo-400' : 'text-slate-400'
          }`}
        >
          <QrCode size={18} />
          <span>QR Pass</span>
        </button>
      </nav>
    </div>
  );
}
