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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in overflow-y-auto no-scrollbar">
      <div 
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-slate-200/90 bg-white text-slate-900 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 flex flex-col max-h-[85vh] sm:max-h-[80vh]"
      >
        {/* Mobile Pull Bar */}
        <div className="pt-2 sm:hidden flex justify-center bg-slate-50/50">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <Eye size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold font-display text-slate-900 truncate">
                  Live Viewers In Room
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                  {viewers.length} {viewers.length === 1 ? 'Viewer' : 'Viewers'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {groupName ? `${groupName} · ` : ''}{month !== undefined ? `Month ${month}` : 'Live Bidding Session'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Attendance stat bar */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-slate-100 bg-white flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-indigo-600" />
            <span className="font-semibold text-slate-600">Turnout:</span>
            <span className="font-mono font-bold text-slate-900">
              {viewers.length} / {totalMembers} Members
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Real-time Connected
          </span>
        </div>

        {/* Viewers List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 no-scrollbar">
          {viewers.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
                <Users size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-900 font-display">No Subscribers Currently Connected</h4>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Subscribers who enter the Live Bidding Floor will automatically appear here with their ticket details.
              </p>
            </div>
          ) : (
            viewers.map((viewer, idx) => (
              <div
                key={viewer.key || `viewer-${idx}`}
                className="p-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-900 flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Ticket Badge / Avatar */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black font-mono shrink-0 shadow-xs ${
                    viewer.ticketNumber 
                      ? 'bg-indigo-50 border border-indigo-200 text-indigo-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {viewer.ticketNumber ? `#${viewer.ticketNumber}` : <User size={16} />}
                  </div>

                  {/* Name and info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold truncate text-slate-900">
                        {viewer.fullName || 'Subscriber'}
                      </span>
                      {viewer.role === 'admin' && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
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
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                      <Crown size={10} /> Already Won
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      <Sparkles size={10} /> Eligible Bidder
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50 text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-98"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
