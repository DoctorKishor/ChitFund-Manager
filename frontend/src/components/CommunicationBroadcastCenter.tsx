'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { HelpTooltip } from './HelpTooltip';
import { triggerHapticFeedback } from '@/utils/haptics';
import { computeNextAuctionDateTime, formatTime12h, getFirstSundayOnOrAfterDay } from '@/utils/auctionSchedule';
import { 
  Send, 
  Copy, 
  Check, 
  ExternalLink,
  MessageSquare,
  Sparkles,
  Info,
  Calendar,
  Layers,
  FileText,
  Clock,
  Code2,
  Eye,
  Columns,
  RotateCcw,
  Search,
  CheckCircle2,
  ChevronDown,
  Trophy,
  Coins,
  Building,
  User,
  Phone,
  Tag,
  AlertCircle
} from 'lucide-react';

interface GroupMetadata {
  id: string;
  name: string;
  totalValue: number;
  memberCount: number;
  durationMonths: number;
  currentMonth: number;
  kaiIruppuPool: number;
  auctionDayOfMonth: number;
  auctionTime: string;
  nextAuctionDate: string;
  nextAuctionTime: string;
  startDate: string;
  calculatedAuctionDate: Date;
  formattedAuctionDate: string;
  formattedAuctionTime: string;
  nextCalculatedDate: Date;
  formattedNextAuctionDate: string;
  winnerName: string;
  winnerTicketNumber?: number;
  winningDiscount: number;
  netPayout: number;
  fixedInstallment: number;
  isLaabaSeetuActive: boolean;
}

interface VariableDefinition {
  key: string;
  label: string;
  category: 'group' | 'auction' | 'financials' | 'winner' | 'org';
  description: string;
  example: (meta: GroupMetadata | null, orgSig: string, orgPhone: string) => string;
}

const BROADCAST_VARIABLES: VariableDefinition[] = [
  // Chit Group Details
  {
    key: 'group_name',
    label: 'Chit Group Name',
    category: 'group',
    description: 'Name of the selected chit group',
    example: (m) => m?.name || 'Gold Star Chit',
  },
  {
    key: 'current_month',
    label: 'Current Month #',
    category: 'group',
    description: 'Current cycle month number (e.g. 1, 2)',
    example: (m) => String(m?.currentMonth ?? 1),
  },
  {
    key: 'month_display',
    label: 'Month Display Label',
    category: 'group',
    description: 'Formatted month label (e.g. Month 1 or Month 0 - Launch)',
    example: (m) => (m?.currentMonth === 0 ? 'Month 0 (Launch Month)' : `Month ${m?.currentMonth ?? 1}`),
  },
  {
    key: 'total_chit_value',
    label: 'Total Chit Value',
    category: 'group',
    description: 'Total value pool of the chit fund',
    example: (m) => formatINR(m?.totalValue ?? 200000),
  },
  {
    key: 'member_count',
    label: 'Member Count',
    category: 'group',
    description: 'Total member tickets in the group',
    example: (m) => String(m?.memberCount ?? 20),
  },
  {
    key: 'duration_months',
    label: 'Group Duration',
    category: 'group',
    description: 'Total duration in months',
    example: (m) => `${m?.durationMonths ?? 20} Months`,
  },

  // Auction Dates & Timings
  {
    key: 'auction_date',
    label: 'Auction Date',
    category: 'auction',
    description: 'Date of this monthly auction session',
    example: (m) => m?.formattedAuctionDate || 'Sun, 12 Oct 2026',
  },
  {
    key: 'auction_time',
    label: 'Auction Time',
    category: 'auction',
    description: '12-hour scheduled auction time',
    example: (m) => m?.formattedAuctionTime || '07:00 PM',
  },
  {
    key: 'next_auction_date',
    label: 'Next Upcoming Auction Date',
    category: 'auction',
    description: 'Upcoming scheduled date for subsequent month',
    example: (m) => m?.formattedNextAuctionDate || 'Sun, 09 Nov 2026',
  },

  // Financials & Installments
  {
    key: 'installment_due',
    label: 'Monthly Installment Due',
    category: 'financials',
    description: 'Monthly installment due per member ticket',
    example: (m) => (m?.isLaabaSeetuActive ? '₹0 (Laaba Seetu)' : formatINR(m?.fixedInstallment ?? 10000)),
  },
  {
    key: 'kai_iruppu_pool',
    label: 'Accumulated Discount Pool',
    category: 'financials',
    description: 'Running discount pool (Kai Iruppu)',
    example: (m) => formatINR(m?.kaiIruppuPool ?? 35000),
  },
  {
    key: 'laaba_seetu_status',
    label: 'Laaba Seetu Status',
    category: 'financials',
    description: 'Current profit month status',
    example: (m) => (m?.isLaabaSeetuActive ? 'ACTIVE (₹0 Installment Due)' : 'Accumulating'),
  },
  {
    key: 'laaba_seetu_notice',
    label: 'Laaba Seetu Banner Text',
    category: 'financials',
    description: 'Automatic banner notice if Laaba Seetu is active this month',
    example: (m) =>
      m?.isLaabaSeetuActive
        ? '🎉 SPECIAL PROFIT MONTH (LAABA SEETU)! Monthly installment due is ₹0 for all subscribers.\n'
        : '',
  },

  // Winner Details & Post-Auction
  {
    key: 'winner_name',
    label: 'Auction Winner Name',
    category: 'winner',
    description: 'Full name of winning subscriber',
    example: (m) => m?.winnerName || 'Ramesh Kumar',
  },
  {
    key: 'winner_ticket',
    label: 'Winner Ticket #',
    category: 'winner',
    description: 'Ticket number of the auction winner',
    example: (m) => (m?.winnerTicketNumber ? `Ticket #${m.winnerTicketNumber}` : 'Ticket #4'),
  },
  {
    key: 'winning_discount',
    label: 'Winning Bid Discount',
    category: 'winner',
    description: 'Discount amount bid by winning subscriber',
    example: (m) => formatINR(m?.winningDiscount ?? 30000),
  },
  {
    key: 'net_payout',
    label: 'Winner Net Payout',
    category: 'winner',
    description: 'Net prize pot disbursed to the winner',
    example: (m) => formatINR(m?.netPayout ?? 170000),
  },

  // Organization & Contacts
  {
    key: 'org_signature',
    label: 'Organization Signature',
    category: 'org',
    description: 'Custom organization name or signature line',
    example: (_, orgSig) => orgSig || "Dr. Kishor Anbazhakan's Chit Fund Organization",
  },
  {
    key: 'org_phone',
    label: 'Organizer Phone',
    category: 'org',
    description: 'Organizer contact mobile number',
    example: (_, __, orgPhone) => orgPhone || '9943609010',
  },
  {
    key: 'today_date',
    label: "Today's Date",
    category: 'org',
    description: "Current calendar date formatted (e.g. 23 Sep 2026)",
    example: () =>
      new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  },
];

function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);
}

function formatDatePretty(d: Date): string {
  if (!d || isNaN(d.getTime())) return 'Scheduled Date';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Standard Default Templates
const DEFAULT_PRE_AUCTION_TEMPLATE = `Dear Members,

Group [{group_name}] Auction #[{month_display}] is scheduled for {auction_date} at {auction_time}.
Monthly Installment Due per ticket: [{installment_due}].
Total Chit Value: {total_chit_value} | Members: {member_count}
{laaba_seetu_notice}
Please clear all outstanding installment dues prior to the live bidding session.

Regards,
{org_signature}
Contact: {org_phone}`;

const DEFAULT_POST_AUCTION_TEMPLATE = `Dear Members,

Group [{group_name}] Auction #[{month_display}] has concluded successfully!

🏆 Auction Winner: {winner_name} ({winner_ticket})
💰 Winning Discount: {winning_discount}
💵 Net Winner Payout: {net_payout}
📊 Accumulated Discount Pool: {kai_iruppu_pool}

Next Monthly Auction: {next_auction_date}

Regards,
{org_signature}
Contact: {org_phone}`;

interface CommunicationBroadcastCenterProps {
  onAddAuditLog?: (desc: string) => void;
}

export default function CommunicationBroadcastCenter({ onAddAuditLog }: CommunicationBroadcastCenterProps) {
  const { profile, user } = useAuth();
  const [groupsMetadata, setGroupsMetadata] = useState<Record<string, GroupMetadata>>({});
  const [activeGroupKey, setActiveGroupKey] = useState<string>('');
  const [templateType, setTemplateType] = useState<'pre-auction' | 'post-auction'>('pre-auction');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Template View Mode: 'edit' | 'preview' | 'split'
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split');

  // Custom Templates per type (loaded from localStorage or defaults)
  const [preAuctionTemplate, setPreAuctionTemplate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chit_template_pre_auction') || DEFAULT_PRE_AUCTION_TEMPLATE;
    }
    return DEFAULT_PRE_AUCTION_TEMPLATE;
  });

  const [postAuctionTemplate, setPostAuctionTemplate] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chit_template_post_auction') || DEFAULT_POST_AUCTION_TEMPLATE;
    }
    return DEFAULT_POST_AUCTION_TEMPLATE;
  });

  // Custom Dynamic Signature & Phone Line
  const [signatureLine, setSignatureLine] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('chit_broadcast_signature') ||
        (profile?.fullName ? `${profile.fullName}'s Chit Fund Organization` : 'Chit Fund Organization')
      );
    }
    return profile?.fullName ? `${profile.fullName}'s Chit Fund Organization` : 'Chit Fund Organization';
  });

  const [contactPhone, setContactPhone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chit_broadcast_phone') || profile?.phoneNumber || '9943609010';
    }
    return profile?.phoneNumber || '9943609010';
  });

  // Autocomplete popup state for typing `{` or `<`
  const [showSuggestMenu, setShowSuggestMenu] = useState<boolean>(false);
  const [suggestFilter, setSuggestFilter] = useState<string>('');
  const [suggestIndex, setSuggestIndex] = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [variableSearchTerm, setVariableSearchTerm] = useState<string>('');
  const [showVariableDrawer, setShowVariableDrawer] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync profile data when available
  useEffect(() => {
    if (profile?.fullName && !localStorage.getItem('chit_broadcast_signature')) {
      setSignatureLine(`${profile.fullName}'s Chit Fund Organization`);
    }
    if (profile?.phoneNumber && !localStorage.getItem('chit_broadcast_phone')) {
      setContactPhone(profile.phoneNumber);
    }
  }, [profile]);

  // Persist signature and phone to localStorage
  const handleSignatureChange = (val: string) => {
    setSignatureLine(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chit_broadcast_signature', val);
    }
  };

  const handlePhoneChange = (val: string) => {
    setContactPhone(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('chit_broadcast_phone', val);
    }
  };

  // Fetch active chit groups and winner details from Supabase
  const fetchGroups = async () => {
    try {
      setLoading(true);
      const { data: groupsData } = await supabase
        .from('chit_groups')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (groupsData && groupsData.length > 0) {
        const metaMap: Record<string, GroupMetadata> = {};

        // Fetch auction logs & winner profile names
        const { data: logsData } = await supabase
          .from('auction_logs')
          .select(`
            *,
            profiles:winning_bidder_id (
              id,
              full_name,
              phone_number
            )
          `)
          .order('month', { ascending: false });

        // Fetch group memberships to resolve winner ticket numbers
        const { data: membersData } = await supabase
          .from('group_members')
          .select('group_id, profile_id, ticket_number');

        groupsData.forEach((g: any) => {
          const totalVal = Number(g.total_value) || 100000;
          const memberCount = Number(g.member_count) || Number(g.duration_months) || 10;
          const duration = Number(g.duration_months) || memberCount;
          const installment = Math.floor(totalVal / (memberCount || 1));
          const currentM = (g.current_month !== undefined && g.current_month !== null) ? Number(g.current_month) : 0;
          const kaiIruppu = Number(g.kai_iruppu_pool) || 0;

          // Check if Laaba Seetu is active (kai_iruppu_pool >= total_value)
          const isLaabaSeetu = kaiIruppu >= totalVal && currentM > 0;

          // Compute dates
          const calcAuctionDate = computeNextAuctionDateTime(g);
          const formattedDate = formatDatePretty(calcAuctionDate);
          const formattedTime = formatTime12h(g.next_auction_time || g.auction_time || '19:00');

          // Compute Next Month's Date
          const nextCycleDate = new Date(calcAuctionDate);
          nextCycleDate.setMonth(nextCycleDate.getMonth() + 1);
          const nextMonthSunday = getFirstSundayOnOrAfterDay(
            nextCycleDate.getFullYear(),
            nextCycleDate.getMonth(),
            g.auction_day_of_month || 10
          );
          const formattedNextDate = formatDatePretty(nextMonthSunday);

          // Find winner details from auction logs
          const groupLogs = (logsData || []).filter((l: any) => l.group_id === g.id && Number(l.month) === currentM);
          const latestLog = groupLogs[0] || (logsData || []).find((l: any) => l.group_id === g.id);

          let winnerName = 'Awaiting Auction';
          let winnerTicket: number | undefined;

          if (latestLog) {
            winnerName =
              latestLog.profiles?.full_name ||
              latestLog.winner_name ||
              (Array.isArray(latestLog.bid_stream) && latestLog.bid_stream[0]?.memberName) ||
              'Winner Confirmed';

            const matchedMember = (membersData || []).find(
              (m: any) => m.group_id === g.id && m.profile_id === latestLog.winning_bidder_id
            );
            if (matchedMember) {
              winnerTicket = matchedMember.ticket_number;
            }
          }

          const winningDiscount = Number(latestLog?.winning_discount ?? latestLog?.winning_bid ?? 0);
          const netPayout = totalVal - winningDiscount;

          metaMap[g.id] = {
            id: g.id,
            name: g.name,
            totalValue: totalVal,
            memberCount: memberCount,
            durationMonths: duration,
            currentMonth: currentM,
            kaiIruppuPool: kaiIruppu,
            auctionDayOfMonth: g.auction_day_of_month || 10,
            auctionTime: g.auction_time || '19:00',
            nextAuctionDate: g.next_auction_date || '',
            nextAuctionTime: g.next_auction_time || '19:00',
            startDate: g.start_date || '',
            calculatedAuctionDate: calcAuctionDate,
            formattedAuctionDate: formattedDate,
            formattedAuctionTime: formattedTime,
            nextCalculatedDate: nextMonthSunday,
            formattedNextAuctionDate: formattedNextDate,
            winnerName: winnerName,
            winnerTicketNumber: winnerTicket,
            winningDiscount: winningDiscount,
            netPayout: netPayout,
            fixedInstallment: isLaabaSeetu ? 0 : installment,
            isLaabaSeetuActive: isLaabaSeetu,
          };
        });

        setGroupsMetadata(metaMap);
        setActiveGroupKey((prev) => (prev && metaMap[prev] ? prev : groupsData[0].id));
      }
    } catch (err) {
      console.error('Error fetching broadcast groups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  // Active raw template based on pre/post switch
  const activeRawTemplate = templateType === 'pre-auction' ? preAuctionTemplate : postAuctionTemplate;

  const handleTemplateChange = (val: string) => {
    if (templateType === 'pre-auction') {
      setPreAuctionTemplate(val);
      if (typeof window !== 'undefined') localStorage.setItem('chit_template_pre_auction', val);
    } else {
      setPostAuctionTemplate(val);
      if (typeof window !== 'undefined') localStorage.setItem('chit_template_post_auction', val);
    }
  };

  const handleResetDefaultTemplate = () => {
    if (confirm('Reset this template back to the standard default format?')) {
      if (templateType === 'pre-auction') {
        setPreAuctionTemplate(DEFAULT_PRE_AUCTION_TEMPLATE);
        if (typeof window !== 'undefined') localStorage.removeItem('chit_template_pre_auction');
      } else {
        setPostAuctionTemplate(DEFAULT_POST_AUCTION_TEMPLATE);
        if (typeof window !== 'undefined') localStorage.removeItem('chit_template_post_auction');
      }
      triggerHapticFeedback('success');
    }
  };

  const selectedMeta = groupsMetadata[activeGroupKey] || null;

  // Real-Time Compiler: Replaces all {variables} with dynamic data
  const compiledBroadcastText = useMemo(() => {
    if (!activeRawTemplate) return '';
    let result = activeRawTemplate;

    BROADCAST_VARIABLES.forEach((v) => {
      const val = v.example(selectedMeta, signatureLine, contactPhone);
      // Replace {key}, {{key}}, and <key> (case-insensitive)
      const regexCurlySingle = new RegExp(`\\{${v.key}\\}`, 'gi');
      const regexCurlyDouble = new RegExp(`\\{\\{${v.key}\\}\\}`, 'gi');
      const regexAngle = new RegExp(`<${v.key}>`, 'gi');

      result = result
        .replace(regexCurlyDouble, val)
        .replace(regexCurlySingle, val)
        .replace(regexAngle, val);
    });

    return result;
  }, [activeRawTemplate, selectedMeta, signatureLine, contactPhone]);

  // Insert a variable token into the textarea at the current cursor position
  const insertVariableAtCursor = (varKey: string) => {
    triggerHapticFeedback('light');
    const token = `{${varKey}}`;
    const textarea = textareaRef.current;

    if (textarea) {
      const start = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || 0;
      const text = activeRawTemplate;
      const updated = text.substring(0, start) + token + text.substring(end);

      handleTemplateChange(updated);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + token.length, start + token.length);
      }, 50);
    } else {
      handleTemplateChange(activeRawTemplate + ' ' + token);
    }

    setShowSuggestMenu(false);
  };

  // Autocomplete Detection on Textarea keyup/change
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    handleTemplateChange(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastOpenBrace = Math.max(textBeforeCursor.lastIndexOf('{'), textBeforeCursor.lastIndexOf('<'));

    if (lastOpenBrace !== -1 && lastOpenBrace >= cursorPos - 15) {
      const query = textBeforeCursor.slice(lastOpenBrace + 1);
      // If no space or closing bracket
      if (!query.includes(' ') && !query.includes('}') && !query.includes('>')) {
        setSuggestFilter(query);
        setShowSuggestMenu(true);
        setSuggestIndex(0);
        return;
      }
    }
    setShowSuggestMenu(false);
  };

  // Keyboard navigation for Autocomplete popup
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestMenu && filteredSuggestVariables.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSuggestIndex((prev) => (prev + 1) % filteredSuggestVariables.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSuggestIndex((prev) => (prev - 1 + filteredSuggestVariables.length) % filteredSuggestVariables.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selectedVar = filteredSuggestVariables[suggestIndex];
        if (selectedVar) {
          const textarea = textareaRef.current;
          if (textarea) {
            const cursorPos = textarea.selectionStart || 0;
            const textBeforeCursor = activeRawTemplate.slice(0, cursorPos);
            const lastOpenBrace = Math.max(textBeforeCursor.lastIndexOf('{'), textBeforeCursor.lastIndexOf('<'));
            if (lastOpenBrace !== -1) {
              const prefix = activeRawTemplate.slice(0, lastOpenBrace);
              const suffix = activeRawTemplate.slice(cursorPos);
              const token = `{${selectedVar.key}}`;
              const updated = prefix + token + suffix;
              handleTemplateChange(updated);
              setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(prefix.length + token.length, prefix.length + token.length);
              }, 50);
            }
          }
          setShowSuggestMenu(false);
        }
      } else if (e.key === 'Escape') {
        setShowSuggestMenu(false);
      }
    }
  };

  // Filtered variables for Autocomplete
  const filteredSuggestVariables = useMemo(() => {
    if (!suggestFilter) return BROADCAST_VARIABLES;
    return BROADCAST_VARIABLES.filter(
      (v) =>
        v.key.toLowerCase().includes(suggestFilter.toLowerCase()) ||
        v.label.toLowerCase().includes(suggestFilter.toLowerCase())
    );
  }, [suggestFilter]);

  // Filtered variables for Variable Chips Drawer
  const filteredDrawerVariables = useMemo(() => {
    return BROADCAST_VARIABLES.filter((v) => {
      const matchCat = selectedCategory === 'all' || v.category === selectedCategory;
      const matchSearch =
        !variableSearchTerm ||
        v.key.toLowerCase().includes(variableSearchTerm.toLowerCase()) ||
        v.label.toLowerCase().includes(variableSearchTerm.toLowerCase()) ||
        v.description.toLowerCase().includes(variableSearchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [selectedCategory, variableSearchTerm]);

  const handleCopyText = () => {
    navigator.clipboard.writeText(compiledBroadcastText);
    setCopied(true);
    triggerHapticFeedback('success');
    setTimeout(() => setCopied(false), 2000);
  };

  const formatWhatsAppUrl = () => {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(compiledBroadcastText)}`;
  };

  return (
    <div className="space-y-4 sm:space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl shrink-0">
            <MessageSquare size={24} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
              <span>Communication &amp; WhatsApp Broadcaster</span>
              <HelpTooltip text="Customize message templates with real-time dynamic variables and broadcast 1-click notices directly to subscribers via WhatsApp." />
            </h2>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              Template-driven broadcast engine with real-time dynamic variables substitution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <span className="text-xs font-bold px-3 py-1.5 bg-white/10 rounded-xl border border-white/10 flex items-center gap-1.5 backdrop-blur-xs">
            <Sparkles size={14} className="text-emerald-400" />
            1-Click WhatsApp Blast
          </span>
        </div>
      </div>

      {/* Organization Signature & Contact Settings Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2">
            <Building size={16} className="text-indigo-600" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Organization Signature &amp; Contact Header
            </h4>
          </div>
          <span className="text-[11px] text-gray-400">
            Automatically appended wherever <code className="text-indigo-600 font-bold">{'{org_signature}'}</code> and <code className="text-indigo-600 font-bold">{'{org_phone}'}</code> are used
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
              <FileText size={13} className="text-gray-500" />
              <span>Organization Text Signature</span>
            </label>
            <input
              type="text"
              value={signatureLine}
              onChange={(e) => handleSignatureChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none font-semibold shadow-2xs"
              placeholder="e.g. Dr. Kishor Anbazhakan's Chit Fund Organization"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
              <Phone size={13} className="text-gray-500" />
              <span>Organizer Contact Phone</span>
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 focus:outline-none font-mono font-semibold shadow-2xs"
              placeholder="e.g. 9943609010"
            />
          </div>
        </div>
      </div>

      {/* Main Broadcast Studio Card */}
      <div className="bg-white border border-gray-200 rounded-3xl p-5 sm:p-6 shadow-2xs space-y-6">
        {/* Top Control Bar: Group Selector, Template Mode, and View Mode */}
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 border-b border-gray-100 pb-5">
          {/* Left: Group Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="space-y-1 min-w-[220px]">
              <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                Target Chit Group
              </label>
              <select
                value={activeGroupKey}
                onChange={(e) => setActiveGroupKey(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-bold text-gray-900 focus:outline-none shadow-2xs"
              >
                {Object.values(groupsMetadata).map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({formatINR(group.totalValue)})
                  </option>
                ))}
              </select>
            </div>

            {selectedMeta && (
              <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-4">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {selectedMeta.currentMonth === 0 ? 'Month 0 (Launch)' : `Month ${selectedMeta.currentMonth}`}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                  📅 {selectedMeta.formattedAuctionDate}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Due: {formatINR(selectedMeta.fixedInstallment)}
                </span>
              </div>
            )}
          </div>

          {/* Right: Template Type Selector & View Modes */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Pre/Post Template Switch */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setTemplateType('pre-auction')}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all ${
                  templateType === 'pre-auction'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Pre-Auction Notice
              </button>
              <button
                type="button"
                onClick={() => setTemplateType('post-auction')}
                className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all ${
                  templateType === 'post-auction'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Post-Auction Summary
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="hidden sm:flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                title="Edit Template with Variables"
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'edit'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Code2 size={14} />
                <span>Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                title="Live Compiled Preview"
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'preview'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Eye size={14} />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                title="Side-by-Side Split View"
                className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  viewMode === 'split'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Columns size={14} />
                <span>Split View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Variable Chips & Quick Insert Bar */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div className="flex items-center space-x-2">
              <Tag size={15} className="text-indigo-600" />
              <span className="text-xs font-bold text-gray-800">
                Click any Dynamic Variable to insert into your template:
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
              {[
                { id: 'all', label: 'All' },
                { id: 'group', label: 'Chit Group' },
                { id: 'auction', label: 'Auction Dates' },
                { id: 'financials', label: 'Financials' },
                { id: 'winner', label: 'Winner Info' },
                { id: 'org', label: 'Organization' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all shrink-0 ${
                    selectedCategory === cat.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Variable Chips Ribbon */}
          <div className="flex flex-wrap gap-2 pt-1 max-h-36 overflow-y-auto pr-1">
            {filteredDrawerVariables.map((v) => {
              const previewSample = v.example(selectedMeta, signatureLine, contactPhone);
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVariableAtCursor(v.key)}
                  title={`${v.description}\nCurrent Value: "${previewSample}"`}
                  className="group inline-flex items-center gap-1.5 bg-white hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 text-gray-800 hover:text-indigo-700 px-2.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all shadow-2xs active:scale-95"
                >
                  <span className="text-indigo-600 font-bold">{`{${v.key}}`}</span>
                  <span className="text-[10px] font-sans text-gray-400 group-hover:text-indigo-600 font-normal">
                    ({v.label})
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-slate-200/60">
            <span>
              💡 <strong>Pro-Tip:</strong> Type <code className="bg-white px-1.5 py-0.5 rounded border text-indigo-600 font-bold">{'{'}</code> or <code className="bg-white px-1.5 py-0.5 rounded border text-indigo-600 font-bold">{'<'}</code> directly inside the editor to open autocomplete.
            </span>

            <button
              type="button"
              onClick={handleResetDefaultTemplate}
              className="text-gray-500 hover:text-rose-600 font-semibold flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={12} />
              <span>Reset Template</span>
            </button>
          </div>
        </div>

        {/* Workspace: Split or Single View */}
        <div className={`grid gap-6 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* LEFT: Template Editor */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className="space-y-2 relative">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Code2 size={14} className="text-indigo-600" />
                  <span>Template Source Code (with Variables)</span>
                </label>
                <span className="text-[11px] text-gray-400 font-mono">
                  {activeRawTemplate.length} chars
                </span>
              </div>

              <div className="relative">
                <textarea
                  ref={textareaRef}
                  rows={14}
                  value={activeRawTemplate}
                  onChange={handleTextareaInput}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder="Type your message template here..."
                  className="w-full bg-slate-900 text-slate-100 border border-slate-700 focus:border-indigo-500 rounded-2xl p-4 text-xs font-mono leading-relaxed focus:outline-none resize-none shadow-inner"
                />

                {/* Autocomplete Dropdown Popup */}
                {showSuggestMenu && filteredSuggestVariables.length > 0 && (
                  <div className="absolute left-4 bottom-6 z-30 bg-white border border-gray-200 rounded-2xl shadow-2xl p-2 w-72 max-h-60 overflow-y-auto space-y-1 animate-in zoom-in-95 duration-100">
                    <div className="px-2 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 flex justify-between items-center">
                      <span>Insert Variable</span>
                      <span className="text-[9px] lowercase font-normal">Press Enter or Tab</span>
                    </div>
                    {filteredSuggestVariables.map((v, idx) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => {
                          insertVariableAtCursor(v.key);
                        }}
                        onMouseEnter={() => setSuggestIndex(idx)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-colors flex items-center justify-between ${
                          suggestIndex === idx
                            ? 'bg-indigo-50 text-indigo-700 font-bold'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="font-mono text-[11px] block truncate">{`{${v.key}}`}</span>
                          <span className="text-[10px] text-gray-400 font-sans block truncate">{v.label}</span>
                        </div>
                        <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                          {v.category}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* RIGHT: Live Compiled Preview */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye size={14} className="text-emerald-600" />
                  <span>Live Compiled Preview (Ready for WhatsApp)</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  ✓ Variables Live Substituted
                </span>
              </div>

              {/* WhatsApp Simulated Bubble */}
              <div className="bg-[#EFEAE2] border border-gray-300 rounded-2xl p-4 shadow-inner flex flex-col justify-between min-h-[320px]">
                <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3 max-w-full text-xs text-gray-900 font-sans whitespace-pre-wrap leading-relaxed border border-emerald-100 relative">
                  <div className="absolute top-2 right-3 text-[10px] text-gray-400 font-mono">
                    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div>{compiledBroadcastText}</div>
                </div>

                <div className="pt-3 text-center text-[11px] text-gray-500">
                  Preview showing dynamic data for <strong>{selectedMeta?.name || 'Chit Group'}</strong>
                </div>
              </div>

              {/* Action Buttons: Copy & Share */}
              <div className="flex flex-col sm:flex-row gap-2.5 sm:justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 active:scale-98 text-gray-800 text-xs font-bold px-5 py-2.5 rounded-xl flex items-center justify-center space-x-2 transition-all border border-gray-300 shadow-2xs"
                >
                  {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  <span>{copied ? 'Copied to Clipboard!' : 'Copy to Clipboard'}</span>
                </button>

                <a
                  href={formatWhatsAppUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold px-6 py-2.5 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-600/20 text-center"
                >
                  <Send size={15} />
                  <span>Share via WhatsApp</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
