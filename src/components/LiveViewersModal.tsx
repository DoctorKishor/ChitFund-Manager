'use client';

import React from 'react';
import { 
  Eye, 
  X, 
  User, 
  CheckCircle2, 
  Crown, 
  Clock, 
  Shield, 
  Users,
  Sparkles
} from 'lucide-react';

export interface ActiveViewerInfo {
  key: string;
  fullName: string;
  ticketNumber?: number | null;
  profileId?: string;
  role?: string;
  hasWonRegular?: boolean;
  joinedAt?: string;
}

interface LiveViewersModalProps {
  isOpen: boolean;
  onClose: () => void;
  viewers: ActiveViewerInfo[];
  totalMembers?: number;
  groupName?: string;
  month?: number;
  isDark?: boolean;
}

export default function LiveViewersModal({
  isOpen,
  onClose,
  viewers,
  totalMembers = 20,
  groupName,
  month,
  isDark = true,
}: LiveViewersModalProps) {
  if (!isOpen) return null;

  const formatJoinedTime = (isoString?: string) => {
    if (!isoString) return 'Active now';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return 'Active now';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div 
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh] ${
          isDark 
            ? 'bg-slate-900 border-slate-800 text-white' 
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-5 border-b flex items-center justify-between gap-3 ${
          isDark 
            ? 'bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-slate-800' 
            : 'bg-gradient-to-r from-slate-50 via-indigo-50/40 to-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Eye size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black truncate">
                  Live Viewers In Room
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black font-mono">
                  {viewers.length} {viewers.length === 1 ? 'Viewer' : 'Viewers'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {groupName ? `${groupName} · ` : ''}{month !== undefined ? `Month ${month}` : 'Live Bidding Session'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-xl border transition-all cursor-pointer shrink-0 ${
              isDark 
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Attendance stat bar */}
        <div className={`px-4 sm:px-5 py-2.5 border-b flex items-center justify-between text-xs ${
          isDark ? 'bg-slate-950/60 border-slate-800/80 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-indigo-400" />
            <span className="font-semibold">Turnout:</span>
            <span className="font-mono font-bold text-slate-300 dark:text-slate-200">
              {viewers.length} / {totalMembers} Members
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Real-time Connected
          </span>
        </div>

        {/* Viewers List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 divide-y-0">
          {viewers.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800/50 border border-slate-700/60 flex items-center justify-center text-slate-400">
                <Users size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-300">No Subscribers Currently Connected</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Subscribers who enter the Live Bidding Floor will automatically appear here with their ticket details.
              </p>
            </div>
          ) : (
            viewers.map((viewer, idx) => (
              <div
                key={viewer.key || `viewer-${idx}`}
                className={`p-3 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                  isDark 
                    ? 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/70 text-slate-200' 
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800 shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Ticket Badge / Avatar */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black font-mono shrink-0 shadow-xs ${
                    viewer.ticketNumber 
                      ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white'
                      : 'bg-slate-700 text-slate-300'
                  }`}>
                    {viewer.ticketNumber ? `#${viewer.ticketNumber}` : <User size={16} />}
                  </div>

                  {/* Name and info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {viewer.fullName || 'Subscriber'}
                      </span>
                      {viewer.role === 'admin' && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Host
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-medium mt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock size={10} /> {formatJoinedTime(viewer.joinedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="text-right shrink-0">
                  {viewer.hasWonRegular ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/20 text-[10px] font-bold">
                      <Crown size={10} /> Already Won
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                      <Sparkles size={10} /> Eligible Bidder
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className={`p-3 sm:p-4 border-t text-center ${
          isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-98"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
