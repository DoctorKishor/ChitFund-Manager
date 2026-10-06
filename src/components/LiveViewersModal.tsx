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
        className="w-full max-w-md rounded-3xl border border-[#27264E] bg-[#1D1D41] text-white shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#27264E] bg-[#1D1D41] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Eye size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  Live Viewers In Room
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-black font-mono">
                  {viewers.length} {viewers.length === 1 ? 'Viewer' : 'Viewers'}
                </span>
              </div>
              <p className="text-[11px] text-[#AEABD8] truncate">
                {groupName ? `${groupName} · ` : ''}{month !== undefined ? `Month ${month}` : 'Live Bidding Session'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-[#27264E] bg-[#141332] hover:bg-[#27264E] text-[#AEABD8] hover:text-white transition-all cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Attendance stat bar */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-[#27264E] bg-[#141332] flex items-center justify-between text-xs text-[#AEABD8]">
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-[#64CFF6]" />
            <span className="font-semibold text-[#AEABD8]">Turnout:</span>
            <span className="font-mono font-bold text-white">
              {viewers.length} / {totalMembers} Members
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[#02B15A]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#02B15A]" />
            </span>
            Real-time Connected
          </span>
        </div>

        {/* Viewers List */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 divide-y-0">
          {viewers.length === 0 ? (
            <div className="text-center py-10 px-4 space-y-2">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-[#141332] border border-[#27264E] flex items-center justify-center text-[#AEABD8]">
                <Users size={24} />
              </div>
              <h4 className="text-sm font-bold text-white">No Subscribers Currently Connected</h4>
              <p className="text-xs text-[#AEABD8] max-w-xs mx-auto">
                Subscribers who enter the Live Bidding Floor will automatically appear here with their ticket details.
              </p>
            </div>
          ) : (
            viewers.map((viewer, idx) => (
              <div
                key={viewer.key || `viewer-${idx}`}
                className="p-3 rounded-2xl border border-[#27264E] bg-[#141332] hover:bg-[#1D1D41] text-white flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Ticket Badge / Avatar */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black font-mono shrink-0 shadow-xs ${
                    viewer.ticketNumber 
                      ? 'bg-gradient-to-r from-[#9C2CF3] to-[#3A6FF9] text-white'
                      : 'bg-[#27264E] text-[#AEABD8]'
                  }`}>
                    {viewer.ticketNumber ? `#${viewer.ticketNumber}` : <User size={16} />}
                  </div>

                  {/* Name and info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs sm:text-sm font-bold truncate text-white">
                        {viewer.fullName || 'Subscriber'}
                      </span>
                      {viewer.role === 'admin' && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-[#FFBB38]/20 text-[#FFBB38] border border-[#FFBB38]/30">
                          Host
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] text-[#AEABD8] font-medium mt-0.5">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock size={10} /> {formatJoinedTime(viewer.joinedAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="text-right shrink-0">
                  {viewer.hasWonRegular ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFBB38]/15 text-[#FFBB38] border border-[#FFBB38]/30 text-[10px] font-bold">
                      <Crown size={10} /> Already Won
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                      <Sparkles size={10} /> Eligible Bidder
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-[#27264E] bg-[#1D1D41] text-center">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-[#6359E9] hover:bg-[#6F64FF] text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-98"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
