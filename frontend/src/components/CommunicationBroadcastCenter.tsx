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
  AlertCircle,
  Plus,
  Smile,
  CloudCheck,
  Cloud,
  CloudUpload,
  RefreshCw,
  Sliders,
  Languages
} from 'lucide-react';

interface GroupMetadata {
  id: string;
  name: string;
  totalValue: number;
  memberCount: number;
  durationMonths: number;
  currentMonth: number;
  kaiIruppuPool: number;
  previousPool: number;
  auctionDayOfMonth: number;
  auctionTime: string;
  nextAuctionDate: string;
  nextAuctionTime: string;
  startDate: string;
  calculatedAuctionDate: Date;
  formattedAuctionDate: string;
  formattedAuctionDateShort: string;
  formattedAuctionDayTamil: string;
  formattedAuctionTime: string;
  formattedAuctionTimeTamil: string;
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
  getValue: (meta: GroupMetadata | null, orgSig: string, orgPhone: string) => string;
}

// Tamil Day Names
const TAMIL_DAYS = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];

function formatTamilTime(timeStr?: string | null, d?: Date): string {
  let hour = 10;
  let minute = '30';
  if (timeStr) {
    const parts = timeStr.trim().split(':');
    if (parts.length >= 2) {
      hour = parseInt(parts[0], 10);
      minute = parts[1].slice(0, 2);
    }
  } else if (d) {
    hour = d.getHours();
    minute = String(d.getMinutes()).padStart(2, '0');
  }

  let period = 'காலை';
  if (hour >= 12 && hour < 16) {
    period = 'மதியம்';
  } else if (hour >= 16 && hour < 20) {
    period = 'மாலை';
  } else if (hour >= 20 || hour < 4) {
    period = 'இரவு';
  }

  let displayHour = hour % 12;
  if (displayHour === 0) displayHour = 12;

  return `${period} ${displayHour}.${minute}`;
}

function formatShortDate(d: Date): string {
  if (!d || isNaN(d.getTime())) return '12/7/26';
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const yearShort = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${yearShort}`;
}

const BROADCAST_VARIABLES: VariableDefinition[] = [
  // Chit Group Details
  {
    key: 'group_name',
    label: 'Chit Group Name',
    category: 'group',
    description: 'Name of the selected chit group',
    getValue: (m) => m?.name || 'Sample Chit Group',
  },
  {
    key: 'current_month',
    label: 'Current Month #',
    category: 'group',
    description: 'Current cycle month number (e.g. 21)',
    getValue: (m) => String(m?.currentMonth ?? 1),
  },
  {
    key: 'month_display',
    label: 'Month Label (EN)',
    category: 'group',
    description: 'Formatted month label (Month 1, Month 0 - Launch)',
    getValue: (m) => (m?.currentMonth === 0 ? 'Month 0 (Launch Month)' : `Month ${m?.currentMonth ?? 1}`),
  },
  {
    key: 'total_chit_value',
    label: 'Total Chit Value (₹)',
    category: 'group',
    description: 'Formatted total value pool (₹2,40,000)',
    getValue: (m) => formatINR(m?.totalValue ?? 240000),
  },
  {
    key: 'total_chit_value_raw',
    label: 'Total Value Plain (240000)',
    category: 'group',
    description: 'Plain numeric total value without ₹ symbol',
    getValue: (m) => String(m?.totalValue ?? 240000),
  },
  {
    key: 'member_count',
    label: 'Member Count (24)',
    category: 'group',
    description: 'Total member tickets in group',
    getValue: (m) => String(m?.memberCount ?? 20),
  },
  {
    key: 'duration_months',
    label: 'Group Duration',
    category: 'group',
    description: 'Total duration in months',
    getValue: (m) => `${m?.durationMonths ?? 20} Months`,
  },

  // Auction Dates & Timings (English & Tamil)
  {
    key: 'auction_date',
    label: 'Auction Date (Sun, 12 Oct)',
    category: 'auction',
    description: 'Formatted auction date in English',
    getValue: (m) => m?.formattedAuctionDate || 'Sun, 12 Jul 2026',
  },
  {
    key: 'auction_date_short',
    label: 'Auction Date Short (12/7/26)',
    category: 'auction',
    description: 'Short numeric date format D/M/YY',
    getValue: (m) => m?.formattedAuctionDateShort || '12/7/26',
  },
  {
    key: 'auction_day_tamil',
    label: 'Tamil Day (ஞாயிறு)',
    category: 'auction',
    description: 'Day name in Tamil (ஞாயிறு, திங்கள், etc.)',
    getValue: (m) => m?.formattedAuctionDayTamil || 'ஞாயிறு',
  },
  {
    key: 'auction_time',
    label: 'Auction Time (10:30 AM)',
    category: 'auction',
    description: '12-hour English auction time',
    getValue: (m) => m?.formattedAuctionTime || '10:30 AM',
  },
  {
    key: 'auction_time_tamil',
    label: 'Tamil Time (காலை 10.30)',
    category: 'auction',
    description: 'Time formatted in Tamil (காலை 10.30, மாலை 7.00)',
    getValue: (m) => m?.formattedAuctionTimeTamil || 'காலை 10.30',
  },
  {
    key: 'next_auction_date',
    label: 'Next Month Auction Date',
    category: 'auction',
    description: 'Upcoming scheduled date for next month',
    getValue: (m) => m?.formattedNextAuctionDate || 'Sun, 09 Aug 2026',
  },

  // Financials & Installments
  {
    key: 'installment_due',
    label: 'Monthly Installment (₹10,000)',
    category: 'financials',
    description: 'Monthly installment due with ₹ symbol',
    getValue: (m) => (m?.isLaabaSeetuActive ? '₹0 (Laaba Seetu)' : formatINR(m?.fixedInstallment ?? 10000)),
  },
  {
    key: 'installment_due_raw',
    label: 'Installment Plain (10000)',
    category: 'financials',
    description: 'Plain numeric installment without ₹ symbol',
    getValue: (m) => (m?.isLaabaSeetuActive ? '0' : String(m?.fixedInstallment ?? 10000)),
  },
  {
    key: 'kai_iruppu_pool',
    label: 'Discount Pool (₹1,68,000)',
    category: 'financials',
    description: 'Current accumulated discount pool with ₹',
    getValue: (m) => formatINR(m?.kaiIruppuPool ?? 168000),
  },
  {
    key: 'kai_iruppu_pool_raw',
    label: 'Discount Pool Plain (168000)',
    category: 'financials',
    description: 'Plain current accumulated discount pool',
    getValue: (m) => String(m?.kaiIruppuPool ?? 168000),
  },
  {
    key: 'previous_pool',
    label: 'Previous Pool (₹1,67,000)',
    category: 'financials',
    description: 'Discount pool before this auction with ₹',
    getValue: (m) => formatINR(m?.previousPool ?? 167000),
  },
  {
    key: 'previous_pool_raw',
    label: 'Previous Pool Plain (167000)',
    category: 'financials',
    description: 'Plain discount pool before this auction',
    getValue: (m) => String(m?.previousPool ?? 167000),
  },
  {
    key: 'laaba_seetu_status',
    label: 'Laaba Seetu Status',
    category: 'financials',
    description: 'Current profit month status',
    getValue: (m) => (m?.isLaabaSeetuActive ? 'ACTIVE (₹0 Installment Due)' : 'Accumulating'),
  },
  {
    key: 'laaba_seetu_notice',
    label: 'Laaba Seetu Banner Notice',
    category: 'financials',
    description: 'Automatic notice if Laaba Seetu is active',
    getValue: (m) =>
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
    getValue: (m) => m?.winnerName || 'Pending Auction',
  },
  {
    key: 'winner_ticket',
    label: 'Winner Ticket #',
    category: 'winner',
    description: 'Ticket number of the auction winner',
    getValue: (m) => (m?.winnerTicketNumber ? `Ticket #${m.winnerTicketNumber}` : 'Ticket #1'),
  },
  {
    key: 'winning_discount',
    label: 'Winning Discount (₹1,000)',
    category: 'winner',
    description: 'Discount amount bid by winner with ₹',
    getValue: (m) => formatINR(m?.winningDiscount ?? 1000),
  },
  {
    key: 'winning_discount_raw',
    label: 'Winning Discount Plain (1000)',
    category: 'winner',
    description: 'Plain numeric winning discount bid',
    getValue: (m) => String(m?.winningDiscount ?? 1000),
  },
  {
    key: 'net_payout',
    label: 'Winner Net Payout (₹)',
    category: 'winner',
    description: 'Net prize pot disbursed to winner',
    getValue: (m) => formatINR(m?.netPayout ?? (m?.totalValue ?? 240000)),
  },

  // Organization & Contacts
  {
    key: 'org_signature',
    label: 'Organization Signature',
    category: 'org',
    description: 'Custom organization name or signature line',
    getValue: (_, orgSig) => orgSig || "Dr. Kishor Anbazhakan's Chit Fund Organization",
  },
  {
    key: 'org_phone',
    label: 'Organizer Phone',
    category: 'org',
    description: 'Organizer contact mobile number',
    getValue: (_, __, orgPhone) => orgPhone || '9943609010',
  },
  {
    key: 'app_portal_url',
    label: 'App Portal Link (URL)',
    category: 'org',
    description: 'Hosted web link for members to access passbook & chit ledger',
    getValue: () =>
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'https://chitfund.app',
  },
  {
    key: 'app_url',
    label: 'App URL Short',
    category: 'org',
    description: 'Alias for App Portal web link',
    getValue: () =>
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL || 'https://chitfund.app',
  },
  {
    key: 'today_date',
    label: "Today's Date",
    category: 'org',
    description: "Current calendar date (e.g. 23 Sep 2026)",
    getValue: () =>
      new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  },
];

// Standard Default Templates (Option A: Traditional & Respectful with Rupee symbols, Dividers, & Portal Link)
const DEFAULT_PRE_AUCTION_EN = `Dear Members,

*{group_name} — Month {current_month} Auction Notice*
━━━━━━━━━━━━━━━━━━━━
• Date : *{auction_date} ({auction_date_short})*
• Time : *{auction_time}*
• Installment : *₹{installment_due_raw}*
━━━━━━━━━━━━━━━━━━━━
*Chit Details:*
{member_count} Members × ₹{installment_due_raw} = *₹{total_chit_value_raw}*
{laaba_seetu_notice}
Please ensure your timely presence and participation.

📲 *Track your chit details & live passbook:*
{app_portal_url}

Regards,
*{org_signature}*
Contact: {org_phone}`;

const DEFAULT_POST_AUCTION_EN = `Dear Members,

*{group_name} — Month {current_month} Auction Summary*
━━━━━━━━━━━━━━━━━━━━
• Winning Discount : *₹{winning_discount_raw}*
• Previous Pool : *₹{previous_pool_raw}*
• Current Discount Pool : *₹{kai_iruppu_pool_raw}*
━━━━━━━━━━━━━━━━━━━━
• Winner : *{winner_name} ({winner_ticket})*
• Net Winner Payout : *{net_payout}*
• Next Auction Date : *{next_auction_date}*

📲 *Track your chit details & live passbook:*
{app_portal_url}

Regards,
*{org_signature}*
Contact: {org_phone}`;

const DEFAULT_PRE_AUCTION_TA = `அன்புடையீர் வணக்கம்,

நமது *{group_name}* சீட்டின் *{current_month}-ம் மாத ஏல அறிவிப்பு*
━━━━━━━━━━━━━━━━━━━━
• தேதி : *{auction_date_short} ({auction_day_tamil})*
• நேரம் : *{auction_time_tamil} மணி*
• தவணை : *₹{installment_due_raw}*
━━━━━━━━━━━━━━━━━━━━
*சீட்டு தவணை விவரம்:*
{member_count} நபர்கள் × ₹{installment_due_raw} = *₹{total_chit_value_raw}*
{laaba_seetu_notice}
தாங்கள் தவறாமல் குறித்த நேரத்தில் கலந்துகொள்ள அன்புடன் வேண்டுகிறோம்.

📲 *சீட்டு கணக்கு & பாஸ்புக் விவரங்களை பார்க்க:*
{app_portal_url}

இங்ஙனம்,
*{org_signature}*
தொடர்புக்கு: {org_phone}`;

const DEFAULT_POST_AUCTION_TA = `வணக்கம்,

நமது *{group_name}* சீட்டின் *{current_month}-ம் மாத ஏல கணக்கு விவரம்*
━━━━━━━━━━━━━━━━━━━━
• ஏலத் தள்ளுபடி : *₹{winning_discount_raw}*
• முன் கையிருப்பு : *₹{previous_pool_raw}*
• புதிய கையிருப்பு : *₹{kai_iruppu_pool_raw}*
━━━━━━━━━━━━━━━━━━━━
• வெற்றி பெற்றவர் : *{winner_name} ({winner_ticket})*
• அடுத்த ஏலத் தேதி : *{next_auction_date}*

📲 *சீட்டு கணக்கு & பாஸ்புக் விவரங்களை பார்க்க:*
{app_portal_url}

நன்றி,
*{org_signature}*
தொடர்புக்கு: {org_phone}`;

// Curated Emoji Palette for Professional Chit Broadcasts
const EMOJI_CATEGORIES = [
  {
    id: 'finance',
    name: 'Money & Chit',
    emojis: ['💰', '💵', '🪙', '💳', '🏦', '📈', '📊', '🏷️', '🧾', '💸', '💎'],
  },
  {
    id: 'awards',
    name: 'Winners & Celebration',
    emojis: ['🏆', '🥇', '🥈', '🥉', '🎉', '🎊', '🌟', '⭐', '✨', '🚀', '🎯', '🔥', '👑'],
  },
  {
    id: 'alerts',
    name: 'Notices & Dates',
    emojis: ['📢', '🔔', '⚠️', '⏰', '📅', '🗓️', '⏳', '🚨', '📌', '📍', '✉️', '📩'],
  },
  {
    id: 'status',
    name: 'Status & Checkmarks',
    emojis: ['✅', '❌', '🟢', '🟡', '🔴', '🔒', '🔓', '🤝', '👍', '💯', 'ℹ️', '⚡'],
  },
  {
    id: 'general',
    name: 'Communication & People',
    emojis: ['📱', '💬', '🗣️', '📞', '🇮🇳', '🏛️', '🏢', '👤', '👥', '👨‍💼', '📝', '📋'],
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

function renderWhatsAppFormatted(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, lIdx) => {
        if (!line.trim()) {
          return <div key={lIdx} className="h-2" />;
        }
        if (line.includes('━') || line.includes('───')) {
          return (
            <div key={lIdx} className="text-gray-300 select-none font-mono text-[10px] tracking-tight py-0.5 leading-none">
              {line}
            </div>
          );
        }
        const parts = line.split(/(\*[^*]+\*)/g);
        return (
          <div key={lIdx} className="leading-relaxed">
            {parts.map((part, pIdx) => {
              if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                return (
                  <strong key={pIdx} className="font-bold text-gray-950">
                    {part.slice(1, -1)}
                  </strong>
                );
              }
              return <span key={pIdx}>{part}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
}

interface CommunicationBroadcastCenterProps {
  onAddAuditLog?: (desc: string) => void;
}

export default function CommunicationBroadcastCenter({ onAddAuditLog }: CommunicationBroadcastCenterProps) {
  const { profile } = useAuth();
  const [groupsMetadata, setGroupsMetadata] = useState<Record<string, GroupMetadata>>({});
  const [activeGroupKey, setActiveGroupKey] = useState<string>('');
  
  // Language & Template Mode State
  const [language, setLanguage] = useState<'en' | 'ta'>('ta'); // Default to Tamil as per business style
  const [templateType, setTemplateType] = useState<'pre-auction' | 'post-auction'>('pre-auction');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Template View Mode: 'edit' | 'preview' | 'split'
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split');

  // Cloud Sync Status: 'synced' | 'saving' | 'error'
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Templates Store (EN & TA)
  const [preAuctionEn, setPreAuctionEn] = useState<string>(DEFAULT_PRE_AUCTION_EN);
  const [postAuctionEn, setPostAuctionEn] = useState<string>(DEFAULT_POST_AUCTION_EN);
  const [preAuctionTa, setPreAuctionTa] = useState<string>(DEFAULT_PRE_AUCTION_TA);
  const [postAuctionTa, setPostAuctionTa] = useState<string>(DEFAULT_POST_AUCTION_TA);

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

  // Autocomplete popup state for typing `{`, `<`, or `/`
  const [showSuggestMenu, setShowSuggestMenu] = useState<boolean>(false);
  const [suggestFilter, setSuggestFilter] = useState<string>('');
  const [suggestIndex, setSuggestIndex] = useState<number>(0);
  const [showInsertDropdown, setShowInsertDropdown] = useState<boolean>(false);

  // Emoji Picker Popover State
  const [showEmojiPicker, setShowEmojiPicker] = useState<boolean>(false);
  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('finance');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const insertDropdownRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (insertDropdownRef.current && !insertDropdownRef.current.contains(event.target as Node)) {
        setShowInsertDropdown(false);
      }
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

// Helper to ensure App Portal link is included in templates
function ensurePortalLinkInTemplate(tmpl: string, isTamil: boolean): string {
  if (!tmpl || tmpl.includes('app_portal_url') || tmpl.includes('app_url')) return tmpl;
  
  if (isTamil) {
    const portalSnippet = `📲 *சீட்டு கணக்கு & பாஸ்புக் விவரங்களை பார்க்க:*\n{app_portal_url}\n`;
    if (tmpl.includes('இங்ஙனம்,')) {
      return tmpl.replace('இங்ஙனம்,', `${portalSnippet}\nஇங்ஙனம்,`);
    } else if (tmpl.includes('நன்றி,')) {
      return tmpl.replace('நன்றி,', `${portalSnippet}\nநன்றி,`);
    }
    return tmpl + `\n\n${portalSnippet}`;
  } else {
    const portalSnippet = `📲 *Track your chit details & live passbook:*\n{app_portal_url}\n`;
    if (tmpl.includes('Regards,')) {
      return tmpl.replace('Regards,', `${portalSnippet}\nRegards,`);
    }
    return tmpl + `\n\n${portalSnippet}`;
  }
}

  // 1. Fetch Cloud Templates from Supabase public.system_settings
  const fetchCloudTemplates = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'broadcast_templates')
        .maybeSingle();

      if (data?.value) {
        const val = data.value;
        if (val.pre_auction_en) setPreAuctionEn(ensurePortalLinkInTemplate(val.pre_auction_en, false));
        else if (val.pre_auction) setPreAuctionEn(ensurePortalLinkInTemplate(val.pre_auction, false));

        if (val.post_auction_en) setPostAuctionEn(ensurePortalLinkInTemplate(val.post_auction_en, false));
        else if (val.post_auction) setPostAuctionEn(ensurePortalLinkInTemplate(val.post_auction, false));

        if (val.pre_auction_ta) setPreAuctionTa(ensurePortalLinkInTemplate(val.pre_auction_ta, true));
        if (val.post_auction_ta) setPostAuctionTa(ensurePortalLinkInTemplate(val.post_auction_ta, true));

        if (val.org_signature) setSignatureLine(val.org_signature);
        if (val.org_phone) setContactPhone(val.org_phone);

        setCloudSyncStatus('synced');
      } else {
        // Fallback to local storage
        if (typeof window !== 'undefined') {
          const lPreEn = localStorage.getItem('chit_template_pre_en');
          const lPostEn = localStorage.getItem('chit_template_post_en');
          const lPreTa = localStorage.getItem('chit_template_pre_ta');
          const lPostTa = localStorage.getItem('chit_template_post_ta');
          if (lPreEn) setPreAuctionEn(ensurePortalLinkInTemplate(lPreEn, false));
          if (lPostEn) setPostAuctionEn(ensurePortalLinkInTemplate(lPostEn, false));
          if (lPreTa) setPreAuctionTa(ensurePortalLinkInTemplate(lPreTa, true));
          if (lPostTa) setPostAuctionTa(ensurePortalLinkInTemplate(lPostTa, true));
        }
      }
    } catch (err) {
      console.warn('Note: Cloud templates fetch fallback to local storage:', err);
    }
  }, []);

  // 2. Persist Custom Templates to Supabase
  const persistToCloud = useCallback(async (
    preEn: string,
    postEn: string,
    preTa: string,
    postTa: string,
    sig: string,
    phone: string
  ) => {
    try {
      setCloudSyncStatus('saving');
      const payload = {
        pre_auction_en: preEn,
        post_auction_en: postEn,
        pre_auction_ta: preTa,
        post_auction_ta: postTa,
        org_signature: sig,
        org_phone: phone,
        updated_at: new Date().toISOString(),
      };

      // Also cache in local storage
      if (typeof window !== 'undefined') {
        localStorage.setItem('chit_template_pre_en', preEn);
        localStorage.setItem('chit_template_post_en', postEn);
        localStorage.setItem('chit_template_pre_ta', preTa);
        localStorage.setItem('chit_template_post_ta', postTa);
        localStorage.setItem('chit_broadcast_signature', sig);
        localStorage.setItem('chit_broadcast_phone', phone);
      }

      const { error } = await supabase.from('system_settings').upsert({
        key: 'broadcast_templates',
        value: payload,
        updated_at: new Date().toISOString(),
        updated_by: profile?.id || null,
      });

      if (error) {
        console.warn('Supabase template save note:', error.message);
        setCloudSyncStatus('error');
      } else {
        setCloudSyncStatus('synced');
      }
    } catch (err) {
      console.error('Failed to sync templates to cloud:', err);
      setCloudSyncStatus('error');
    }
  }, [profile]);

  // Debounced cloud saver
  const triggerDebouncedCloudSave = useCallback((
    preEn: string,
    postEn: string,
    preTa: string,
    postTa: string,
    sig: string,
    phone: string
  ) => {
    setCloudSyncStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistToCloud(preEn, postEn, preTa, postTa, sig, phone);
    }, 800);
  }, [persistToCloud]);

  // Initial fetch
  useEffect(() => {
    fetchCloudTemplates();
  }, [fetchCloudTemplates]);

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
          const totalVal = Number(g.total_value) || 240000;
          const memberCount = Number(g.member_count) || Number(g.duration_months) || 24;
          const duration = Number(g.duration_months) || memberCount;
          const installment = Math.floor(totalVal / (memberCount || 1));
          const currentM = (g.current_month !== undefined && g.current_month !== null) ? Number(g.current_month) : 1;
          const kaiIruppu = Number(g.kai_iruppu_pool) || 0;

          // Check if Laaba Seetu is active (kai_iruppu_pool >= total_value)
          const isLaabaSeetu = kaiIruppu >= totalVal && currentM > 0;

          // Compute dates
          const calcAuctionDate = computeNextAuctionDateTime(g);
          const formattedDate = formatDatePretty(calcAuctionDate);
          const formattedDateShort = formatShortDate(calcAuctionDate);
          const formattedDayTamil = TAMIL_DAYS[calcAuctionDate.getDay()] || 'ஞாயிறு';
          const formattedTime = formatTime12h(g.next_auction_time || g.auction_time || '10:30');
          const formattedTimeTamil = formatTamilTime(g.next_auction_time || g.auction_time, calcAuctionDate);

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
          const previousPool = Math.max(0, kaiIruppu - winningDiscount);

          metaMap[g.id] = {
            id: g.id,
            name: g.name,
            totalValue: totalVal,
            memberCount: memberCount,
            durationMonths: duration,
            currentMonth: currentM,
            kaiIruppuPool: kaiIruppu,
            previousPool: previousPool,
            auctionDayOfMonth: g.auction_day_of_month || 10,
            auctionTime: g.auction_time || '10:30',
            nextAuctionDate: g.next_auction_date || '',
            nextAuctionTime: g.next_auction_time || '10:30',
            startDate: g.start_date || '',
            calculatedAuctionDate: calcAuctionDate,
            formattedAuctionDate: formattedDate,
            formattedAuctionDateShort: formattedDateShort,
            formattedAuctionDayTamil: formattedDayTamil,
            formattedAuctionTime: formattedTime,
            formattedAuctionTimeTamil: formattedTimeTamil,
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

  // Retrieve current active raw template
  const activeRawTemplate = useMemo(() => {
    if (language === 'ta') {
      return templateType === 'pre-auction' ? preAuctionTa : postAuctionTa;
    }
    return templateType === 'pre-auction' ? preAuctionEn : postAuctionEn;
  }, [language, templateType, preAuctionEn, postAuctionEn, preAuctionTa, postAuctionTa]);

  const handleTemplateChange = (val: string) => {
    if (language === 'ta') {
      if (templateType === 'pre-auction') {
        setPreAuctionTa(val);
        triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, val, postAuctionTa, signatureLine, contactPhone);
      } else {
        setPostAuctionTa(val);
        triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, preAuctionTa, val, signatureLine, contactPhone);
      }
    } else {
      if (templateType === 'pre-auction') {
        setPreAuctionEn(val);
        triggerDebouncedCloudSave(val, postAuctionEn, preAuctionTa, postAuctionTa, signatureLine, contactPhone);
      } else {
        setPostAuctionEn(val);
        triggerDebouncedCloudSave(preAuctionEn, val, preAuctionTa, postAuctionTa, signatureLine, contactPhone);
      }
    }
  };

  const handleSignatureChange = (val: string) => {
    setSignatureLine(val);
    triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, preAuctionTa, postAuctionTa, val, contactPhone);
  };

  const handlePhoneChange = (val: string) => {
    setContactPhone(val);
    triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, preAuctionTa, postAuctionTa, signatureLine, val);
  };

  const handleResetDefaultTemplate = () => {
    if (confirm(`Reset the current ${language === 'ta' ? 'Tamil' : 'English'} ${templateType} template to standard default?`)) {
      if (language === 'ta') {
        if (templateType === 'pre-auction') {
          setPreAuctionTa(DEFAULT_PRE_AUCTION_TA);
          triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, DEFAULT_PRE_AUCTION_TA, postAuctionTa, signatureLine, contactPhone);
        } else {
          setPostAuctionTa(DEFAULT_POST_AUCTION_TA);
          triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, preAuctionTa, DEFAULT_POST_AUCTION_TA, signatureLine, contactPhone);
        }
      } else {
        if (templateType === 'pre-auction') {
          setPreAuctionEn(DEFAULT_PRE_AUCTION_EN);
          triggerDebouncedCloudSave(DEFAULT_PRE_AUCTION_EN, postAuctionEn, preAuctionTa, postAuctionTa, signatureLine, contactPhone);
        } else {
          setPostAuctionEn(DEFAULT_POST_AUCTION_EN);
          triggerDebouncedCloudSave(preAuctionEn, DEFAULT_POST_AUCTION_EN, preAuctionTa, postAuctionTa, signatureLine, contactPhone);
        }
      }
      triggerHapticFeedback('success');
    }
  };

  const selectedMeta = groupsMetadata[activeGroupKey] || null;

  // Real-Time Compiler: Replaces all {variables} with dynamic live data
  const compiledBroadcastText = useMemo(() => {
    if (!activeRawTemplate) return '';
    let result = activeRawTemplate;

    BROADCAST_VARIABLES.forEach((v) => {
      const val = v.getValue(selectedMeta, signatureLine, contactPhone);
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

  // Insert any text / emoji / variable into the textarea at current cursor position
  const insertTextAtCursor = (insertedText: string, replaceTrigger: boolean = false) => {
    triggerHapticFeedback('light');
    const textarea = textareaRef.current;

    if (textarea) {
      const cursorPos = textarea.selectionStart || 0;
      let start = cursorPos;
      let end = textarea.selectionEnd || cursorPos;
      const text = activeRawTemplate;

      if (replaceTrigger) {
        const textBeforeCursor = text.slice(0, cursorPos);
        const lastTrigger = Math.max(
          textBeforeCursor.lastIndexOf('{'),
          textBeforeCursor.lastIndexOf('<'),
          textBeforeCursor.lastIndexOf('/')
        );
        if (lastTrigger !== -1) {
          start = lastTrigger;
        }
      }

      const updated = text.substring(0, start) + insertedText + text.substring(end);
      handleTemplateChange(updated);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + insertedText.length, start + insertedText.length);
      }, 50);
    } else {
      handleTemplateChange(activeRawTemplate + ' ' + insertedText);
    }

    setShowSuggestMenu(false);
    setShowInsertDropdown(false);
    setShowEmojiPicker(false);
  };

  // Autocomplete Detection on Textarea keyup/change: Triggers on `{`, `<`, or `/`
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    handleTemplateChange(val);

    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPos);
    const lastTrigger = Math.max(
      textBeforeCursor.lastIndexOf('{'),
      textBeforeCursor.lastIndexOf('<'),
      textBeforeCursor.lastIndexOf('/')
    );

    if (lastTrigger !== -1 && lastTrigger >= cursorPos - 20) {
      const query = textBeforeCursor.slice(lastTrigger + 1);
      if (!query.includes(' ') && !query.includes('\n') && !query.includes('}') && !query.includes('>')) {
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
          insertTextAtCursor(`{${selectedVar.key}}`, true);
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
        v.label.toLowerCase().includes(suggestFilter.toLowerCase()) ||
        v.description.toLowerCase().includes(suggestFilter.toLowerCase())
    );
  }, [suggestFilter]);

  // Filtered emojis for Emoji Picker
  const displayedEmojis = useMemo(() => {
    const cat = EMOJI_CATEGORIES.find((c) => c.id === selectedEmojiCategory);
    return cat ? cat.emojis : EMOJI_CATEGORIES[0].emojis;
  }, [selectedEmojiCategory]);

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
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200 pb-12 sm:pb-6">
      
      {/* ── Organization Signature & Contact Header Card ── */}
      <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-gray-100 pb-2.5">
          <div className="flex items-center space-x-2">
            <Building size={16} className="text-indigo-600 shrink-0" />
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Organization Signature &amp; Contact Header
            </h4>
          </div>

          <div className="flex items-center gap-2">
            {/* Supabase Cloud Sync Status Pill */}
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                cloudSyncStatus === 'synced'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : cloudSyncStatus === 'saving'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {cloudSyncStatus === 'synced' ? (
                <>
                  <CheckCircle2 size={11} className="text-emerald-600" />
                  <span>Cloud Synced (Supabase)</span>
                </>
              ) : cloudSyncStatus === 'saving' ? (
                <>
                  <RefreshCw size={11} className="animate-spin text-indigo-600" />
                  <span>Saving to Cloud...</span>
                </>
              ) : (
                <>
                  <CloudUpload size={11} className="text-amber-600" />
                  <span>Saved locally</span>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
              <FileText size={13} className="text-gray-400" />
              <span>Signature Line <code className="text-indigo-600 font-mono font-normal">{'{org_signature}'}</code></span>
            </label>
            <input
              type="text"
              value={signatureLine}
              onChange={(e) => handleSignatureChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:outline-none font-semibold shadow-2xs"
              placeholder="e.g. Dr. Kishor Anbazhakan's Chit Fund Organization"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
              <Phone size={13} className="text-gray-400" />
              <span>Organizer Phone <code className="text-indigo-600 font-mono font-normal">{'{org_phone}'}</code></span>
            </label>
            <input
              type="tel"
              value={contactPhone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-gray-900 focus:outline-none font-mono font-semibold shadow-2xs"
              placeholder="e.g. 9943609010"
            />
          </div>
        </div>
      </div>

      {/* ── Main Broadcast Studio Card ── */}
      <div className="bg-white border border-gray-200 rounded-3xl p-4 sm:p-6 shadow-2xs space-y-4 sm:space-y-5">
        
        {/* Top Control Bar: Group Selector, Language Toggle, Template Mode, and View Mode */}
        <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3.5 border-b border-gray-100 pb-4">
          
          {/* Left: Group Selector & Active Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <div className="space-y-1 min-w-[200px] w-full sm:w-auto">
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
              <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-4">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {selectedMeta.currentMonth === 0 ? 'Month 0 (Launch)' : `Month ${selectedMeta.currentMonth}`}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
                  📅 {selectedMeta.formattedAuctionDateShort} ({selectedMeta.formattedAuctionDayTamil})
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Due: {formatINR(selectedMeta.fixedInstallment)}
                </span>
              </div>
            )}
          </div>

          {/* Right: Language Toggle, Pre/Post Switch, and View Modes */}
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 pt-1 lg:pt-0">
            
            {/* 1. Language Switcher (தமிழ் | English) */}
            <div className="flex items-center bg-indigo-50/80 p-1 rounded-xl border border-indigo-200 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setLanguage('ta');
                  triggerHapticFeedback('light');
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  language === 'ta'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-900 hover:bg-indigo-100/60'
                }`}
              >
                <span>தமிழ்</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  triggerHapticFeedback('light');
                }}
                className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  language === 'en'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-indigo-900 hover:bg-indigo-100/60'
                }`}
              >
                <span>English</span>
              </button>
            </div>

            {/* 2. Pre/Post Template Switch */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setTemplateType('pre-auction')}
                className={`flex-1 sm:flex-initial text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-center ${
                  templateType === 'pre-auction'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {language === 'ta' ? 'முன் அறிவிப்பு' : 'Pre-Auction Notice'}
              </button>
              <button
                type="button"
                onClick={() => setTemplateType('post-auction')}
                className={`flex-1 sm:flex-initial text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-center ${
                  templateType === 'post-auction'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {language === 'ta' ? 'ஏல முடிவு' : 'Post-Auction Summary'}
              </button>
            </div>

            {/* 3. View Mode Segment (Editor | Preview | Split View) */}
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setViewMode('edit')}
                title="Edit Template Source"
                className={`flex-1 sm:flex-initial p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  viewMode === 'edit'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Code2 size={13} />
                <span>Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('preview')}
                title="Live Compiled Preview"
                className={`flex-1 sm:flex-initial p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  viewMode === 'preview'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Eye size={13} />
                <span>Preview</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('split')}
                title="Side-by-Side Split View"
                className={`flex-1 sm:flex-initial p-1.5 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                  viewMode === 'split'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <Columns size={13} />
                <span>Split View</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workspace: Responsive Split or Single View */}
        <div className={`grid gap-4 sm:gap-6 ${viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          
          {/* ── LEFT: Template Editor (LIGHT THEME) ── */}
          {(viewMode === 'edit' || viewMode === 'split') && (
            <div className="space-y-2 relative">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Code2 size={14} className="text-indigo-600" />
                    <span>{language === 'ta' ? 'தமிழ் மாதிரி வடிவம்' : 'Template Source'}</span>
                  </label>

                  {/* 1. Quick Insert Variable Popover Button (Anchored Right-0 on mobile) */}
                  <div className="relative" ref={insertDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInsertDropdown(!showInsertDropdown);
                        setShowEmojiPicker(false);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-lg transition-colors active:scale-95"
                    >
                      <Plus size={12} />
                      <span>{language === 'ta' ? 'விவரம் சேர்க்க' : 'Insert Variable'}</span>
                      <ChevronDown size={11} className={`transition-transform ${showInsertDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showInsertDropdown && (
                      <div className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 z-40 bg-white border border-gray-200 rounded-2xl shadow-xl p-2 w-[calc(100vw-3rem)] max-w-[320px] sm:w-80 max-h-80 overflow-y-auto space-y-1 animate-in zoom-in-95 duration-100">
                        <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                          {language === 'ta' ? 'சீட்டு விவரங்கள் (Dynamic Variables)' : 'Select Dynamic Variable'}
                        </div>
                        {BROADCAST_VARIABLES.map((v) => {
                          const liveVal = v.getValue(selectedMeta, signatureLine, contactPhone);
                          return (
                            <button
                              key={v.key}
                              type="button"
                              onClick={() => insertTextAtCursor(`{${v.key}}`, false)}
                              className="w-full text-left p-2 rounded-xl text-xs hover:bg-indigo-50 transition-colors flex flex-col gap-0.5 group"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-[11px] text-indigo-700 group-hover:text-indigo-900">
                                  {`{${v.key}}`}
                                </span>
                                <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono uppercase">
                                  {v.category}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-gray-500">
                                <span>{v.label}</span>
                                <span className="font-semibold text-emerald-600 truncate max-w-[120px]" title={liveVal}>
                                  {liveVal || '—'}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. Emoji Picker Popover Button (DESKTOP ONLY - hidden on mobile) */}
                  <div className="relative hidden sm:inline-flex" ref={emojiPickerRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEmojiPicker(!showEmojiPicker);
                        setShowInsertDropdown(false);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded-lg transition-colors active:scale-95"
                    >
                      <Smile size={12} className="text-amber-600" />
                      <span>Emojis</span>
                    </button>

                    {showEmojiPicker && (
                      <div className="absolute left-0 top-full mt-1.5 z-40 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 w-80 space-y-2 animate-in zoom-in-95 duration-100">
                        {/* Emoji Category Tabs */}
                        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1">
                          {EMOJI_CATEGORIES.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setSelectedEmojiCategory(c.id)}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all shrink-0 ${
                                selectedEmojiCategory === c.id
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>

                        {/* Emoji Grid */}
                        <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-1 bg-gray-50 rounded-xl border border-gray-100">
                          {displayedEmojis.map((emoji, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => insertTextAtCursor(emoji, false)}
                              className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white rounded-lg transition-all hover:scale-115 active:scale-90"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-[10px] text-gray-400 font-mono">
                    {activeRawTemplate.length} chars
                  </span>
                  <button
                    type="button"
                    onClick={handleResetDefaultTemplate}
                    title="Reset template to standard default"
                    className="text-gray-400 hover:text-rose-600 transition-colors p-1"
                  >
                    <RotateCcw size={13} />
                  </button>
                </div>
              </div>

              {/* Textarea with Light Theme */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  rows={13}
                  value={activeRawTemplate}
                  onChange={handleTextareaInput}
                  onKeyDown={handleTextareaKeyDown}
                  placeholder={language === 'ta' ? 'செய்தி மாதிரி இங்கே தட்டச்சு செய்யவும்... { அல்லது < அல்லது / அழுத்தவும்' : 'Type message template. Type { or < or / to insert live variables...'}
                  className="w-full bg-white text-gray-900 border border-gray-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 rounded-2xl p-3.5 sm:p-4 text-xs font-mono leading-relaxed focus:outline-none resize-none shadow-2xs transition-all"
                />

                {/* Autocomplete Dropdown Popup when typing `{`, `<`, or `/` */}
                {showSuggestMenu && filteredSuggestVariables.length > 0 && (
                  <div className="absolute left-2 right-2 sm:right-auto sm:left-3 top-14 z-30 bg-white border border-gray-200 rounded-2xl shadow-2xl p-2 max-w-[calc(100vw-3.5rem)] sm:w-80 max-h-72 overflow-y-auto space-y-1 animate-in zoom-in-95 duration-100">
                    <div className="px-2.5 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 flex justify-between items-center">
                      <span>{language === 'ta' ? 'விவரம் தேர்வு செய்' : 'Insert Dynamic Variable'}</span>
                      <span className="text-[9px] lowercase font-normal text-indigo-600">Enter / Tab</span>
                    </div>
                    {filteredSuggestVariables.map((v, idx) => {
                      const liveVal = v.getValue(selectedMeta, signatureLine, contactPhone);
                      return (
                        <button
                          key={v.key}
                          type="button"
                          onClick={() => {
                            insertTextAtCursor(`{${v.key}}`, true);
                          }}
                          onMouseEnter={() => setSuggestIndex(idx)}
                          className={`w-full text-left p-2 rounded-xl text-xs transition-colors flex flex-col gap-0.5 ${
                            suggestIndex === idx
                              ? 'bg-indigo-50 border border-indigo-200 shadow-2xs'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-bold text-indigo-700">
                              {`{${v.key}}`}
                            </span>
                            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono uppercase">
                              {v.category}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-gray-500 font-medium truncate max-w-[120px]">{v.label}</span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[130px]" title={liveVal}>
                              Live: {liveVal || '—'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Helper Footer Hint */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                <span>
                  💡 Type <code className="bg-gray-100 px-1 rounded border border-gray-200 text-indigo-700 font-bold">{'{'}</code>, <code className="bg-gray-100 px-1 rounded border border-gray-200 text-indigo-700 font-bold">{'<'}</code>, or <code className="bg-gray-100 px-1 rounded border border-gray-200 text-indigo-700 font-bold">{'/'}</code> for live autocomplete.
                </span>

                <span className="text-[10px] text-emerald-600 font-bold hidden sm:inline">
                  ☁️ Auto-synced to Supabase
                </span>
              </div>
            </div>
          )}

          {/* ── RIGHT: Live Compiled Preview ── */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Eye size={14} className="text-emerald-600" />
                  <span>{language === 'ta' ? 'நேரடி முன்னோட்டம் (வாட்ஸ்அப் செய்தி)' : 'Live Compiled Preview (Ready for WhatsApp)'}</span>
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  ✓ {language === 'ta' ? 'தமிழ் வடிவம்' : 'Real-time Substituted'}
                </span>
              </div>

              {/* WhatsApp Simulated Bubble */}
              <div className="bg-[#EFEAE2] border border-gray-300 rounded-2xl p-3.5 sm:p-4 shadow-inner flex flex-col justify-between min-h-[300px]">
                <div className="bg-white rounded-2xl p-3.5 sm:p-4 shadow-sm max-w-full text-xs text-gray-900 font-sans border border-emerald-100 relative">
                  <div className="absolute top-2 right-3 text-[10px] text-gray-400 font-mono">
                    {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="pt-1">{renderWhatsAppFormatted(compiledBroadcastText)}</div>
                </div>

                <div className="pt-2.5 text-center text-[10px] sm:text-[11px] text-gray-500">
                  {language === 'ta' ? 'சீட்டுக் குழு' : 'Live data for'}: <strong>{selectedMeta?.name || 'Chit Group'}</strong>
                </div>
              </div>

              {/* Action Buttons: Copy to Clipboard & Share via WhatsApp */}
              <div className="flex flex-col sm:flex-row gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={handleCopyText}
                  className="w-full sm:w-auto bg-gray-100 hover:bg-gray-200 active:scale-98 text-gray-800 text-xs font-bold px-5 py-3 sm:py-2.5 rounded-xl flex items-center justify-center space-x-2 transition-all border border-gray-300 shadow-2xs"
                >
                  {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  <span>{copied ? (language === 'ta' ? 'நகலெடுக்கப்பட்டது!' : 'Copied!') : (language === 'ta' ? 'செய்தியை நகலெடு' : 'Copy to Clipboard')}</span>
                </button>

                <a
                  href={formatWhatsAppUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold px-6 py-3 sm:py-2.5 rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-600/20 text-center"
                >
                  <Send size={15} />
                  <span>{language === 'ta' ? 'WhatsApp மூலம் அனுப்புக' : 'Share via WhatsApp'}</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
