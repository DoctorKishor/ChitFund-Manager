'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useOrganization } from '@/context/OrganizationContext';
import { triggerHapticFeedback } from '@/utils/haptics';
import { computeNextAuctionDateTime, formatTime12h, getFirstSundayOnOrAfterDay } from '@/utils/auctionSchedule';
import { Check } from 'lucide-react';

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
  unpaidCount: number;
}

interface VariableDefinition {
  key: string;
  label: string;
  category: 'group' | 'auction' | 'financials' | 'winner' | 'org';
  description: string;
  getValue: (meta: GroupMetadata | null, orgSig: string, orgPhone: string, lang?: 'en' | 'ta') => string;
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

const BROADCAST_VARIABLES: VariableDefinition[] = [
  // Chit Group Details
  {
    key: 'chit_group_name',
    label: 'Chit Group Name',
    category: 'group',
    description: 'Name of the selected chit group',
    getValue: (m) => m?.name || 'Sample Test Group',
  },
  {
    key: 'group_name',
    label: 'Chit Group Name (Alias)',
    category: 'group',
    description: 'Name of the selected chit group',
    getValue: (m) => m?.name || 'Sample Test Group',
  },
  {
    key: 'current_month',
    label: 'Current Month #',
    category: 'group',
    description: 'Current cycle month number (e.g. 2)',
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
    description: 'Formatted total value pool (₹2,00,000)',
    getValue: (m) => formatINR(m?.totalValue ?? 200000),
  },
  {
    key: 'total_chit_value_raw',
    label: 'Total Value Plain (200000)',
    category: 'group',
    description: 'Plain numeric total value without ₹ symbol',
    getValue: (m) => String(m?.totalValue ?? 200000),
  },
  {
    key: 'member_count',
    label: 'Member Count (20)',
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
    key: 'auction_date_time',
    label: 'Auction Date & Time',
    category: 'auction',
    description: 'Formatted combined date and time',
    getValue: (m, _s, _p, lang) => {
      if (!m) return 'Friday, 24 Oct 2026 · 07:00 PM';
      if (lang === 'ta') {
        return `${m.formattedAuctionDayTamil}, ${m.formattedAuctionDateShort} · ${m.formattedAuctionTimeTamil} மணி`;
      }
      return `${m.formattedAuctionDate} · ${m.formattedAuctionTime}`;
    },
  },
  {
    key: 'auction_date',
    label: 'Auction Date (Sun, 12 Oct)',
    category: 'auction',
    description: 'Formatted auction date in English',
    getValue: (m) => m?.formattedAuctionDate || 'Sun, 12 Oct 2026',
  },
  {
    key: 'auction_date_short',
    label: 'Auction Date Short (12/7/26)',
    category: 'auction',
    description: 'Short numeric date format D/M/YY',
    getValue: (m) => m?.formattedAuctionDateShort || '12/10/26',
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
    getValue: (m) => m?.formattedNextAuctionDate || 'Sun, 09 Nov 2026',
  },

  // Financials & Installments
  {
    key: 'monthly_due',
    label: 'Monthly Due (₹10,000)',
    category: 'financials',
    description: 'Monthly installment due with ₹ symbol',
    getValue: (m) => (m?.isLaabaSeetuActive ? '₹0 (Laaba Seetu)' : formatINR(m?.fixedInstallment ?? 10000)),
  },
  {
    key: 'installment_due',
    label: 'Installment Due (Alias)',
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
    key: 'discount_pool_balance',
    label: 'Discount Pool (₹40,500)',
    category: 'financials',
    description: 'Accumulated Kai Iruppu pool with ₹',
    getValue: (m) => formatINR(m?.kaiIruppuPool ?? 40500),
  },
  {
    key: 'kai_iruppu_pool',
    label: 'Discount Pool (Alias)',
    category: 'financials',
    description: 'Current accumulated discount pool with ₹',
    getValue: (m) => formatINR(m?.kaiIruppuPool ?? 40500),
  },
  {
    key: 'kai_iruppu_pool_raw',
    label: 'Discount Pool Plain',
    category: 'financials',
    description: 'Plain current accumulated discount pool',
    getValue: (m) => String(m?.kaiIruppuPool ?? 40500),
  },
  {
    key: 'previous_pool',
    label: 'Previous Pool (₹35,000)',
    category: 'financials',
    description: 'Discount pool before this auction with ₹',
    getValue: (m) => formatINR(m?.previousPool ?? 35000),
  },
  {
    key: 'previous_pool_raw',
    label: 'Previous Pool Plain',
    category: 'financials',
    description: 'Plain discount pool before this auction',
    getValue: (m) => String(m?.previousPool ?? 35000),
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
    label: 'Winning Discount (₹20,000)',
    category: 'winner',
    description: 'Discount amount bid by winner with ₹',
    getValue: (m) => formatINR(m?.winningDiscount ?? 20000),
  },
  {
    key: 'winning_discount_raw',
    label: 'Winning Discount Plain',
    category: 'winner',
    description: 'Plain numeric winning discount bid',
    getValue: (m) => String(m?.winningDiscount ?? 20000),
  },
  {
    key: 'net_payout',
    label: 'Winner Net Payout (₹)',
    category: 'winner',
    description: 'Net prize pot disbursed to winner',
    getValue: (m) => formatINR(m?.netPayout ?? (m?.totalValue ?? 200000)),
  },

  // Organization & Contacts
  {
    key: 'organizer_name',
    label: 'Organizer Name',
    category: 'org',
    description: 'Custom organization name or signature line',
    getValue: (_, orgSig) => orgSig || 'Dr. Kishor Anbazhakan',
  },
  {
    key: 'org_signature',
    label: 'Organizer Name (Alias)',
    category: 'org',
    description: 'Custom organization name or signature line',
    getValue: (_, orgSig) => orgSig || 'Dr. Kishor Anbazhakan',
  },
  {
    key: 'organizer_phone',
    label: 'Organizer Phone',
    category: 'org',
    description: 'Organizer contact mobile number',
    getValue: (_, __, orgPhone) => orgPhone || '+91 99436 09010',
  },
  {
    key: 'org_phone',
    label: 'Organizer Phone (Alias)',
    category: 'org',
    description: 'Organizer contact mobile number',
    getValue: (_, __, orgPhone) => orgPhone || '+91 99436 09010',
  },
  {
    key: 'live_bidding_link',
    label: 'Live Bidding / Portal Link',
    category: 'org',
    description: 'Hosted link for members to access live auction & passbook',
    getValue: (m) => {
      const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://chitfunds.io';
      return `${origin}/auction/m${m?.currentMonth ?? 1}`;
    },
  },
  {
    key: 'app_portal_url',
    label: 'App Portal Link (Alias)',
    category: 'org',
    description: 'Hosted web link for members',
    getValue: (m) => {
      const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://chitfunds.io';
      return `${origin}/auction/m${m?.currentMonth ?? 1}`;
    },
  },
  {
    key: 'today_date',
    label: "Today's Date",
    category: 'org',
    description: "Current calendar date (e.g. 24 Oct 2026)",
    getValue: () =>
      new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
  },
];

// Standard Verified Default Templates
const DEFAULT_PRE_AUCTION_TA = `📢 *சீட்டு ஏல அறிவிப்பு — {chit_group_name}*
வணக்கம் உறுப்பினர்களே! 🙏

எங்களின் *{chit_group_name}* சீட்டு திட்டத்தின் *மாதம் {current_month}* ஏலம் வரவிருக்கிறது:

🗓️ *தேதி & நேரம்:* {auction_date_time}
💰 *மாத தவணை தொகை:* {monthly_due}
🎁 *கை இருப்பு போனஸ் சேமிப்பு:* {discount_pool_balance}
📍 *நேரலை ஏல தளம்:* {live_bidding_link}

⚠️ *முக்கிய குறிப்பு:*
ஏலத்தில் கலந்து கொள்வதற்கு முன் தங்களின் நிலுவைத் தவணையை செலுத்துமாறு கேட்டுக்கொள்கிறோம்.

நன்றி!
*{organizer_name}*
📞 {organizer_phone}`;

const DEFAULT_PRE_AUCTION_EN = `📢 *Auction Announcement — {chit_group_name}*
Dear Members! 🙏

The *Month {current_month}* live auction for *{chit_group_name}* is scheduled as follows:

🗓️ *Date & Time:* {auction_date_time}
💰 *Monthly Due:* {monthly_due}
🎁 *Discount Pool Balance:* {discount_pool_balance}
📍 *Live Bidding Portal:* {live_bidding_link}

⚠️ *Important Note:*
Kindly clear your pending installment dues prior to participating in the live auction.

Regards,
*{organizer_name}*
📞 {organizer_phone}`;

const DEFAULT_POST_AUCTION_TA = `🏆 *சீட்டு ஏல முடிவு — {chit_group_name}*
வணக்கம் உறுப்பினர்களே! 🙏

நமது *{chit_group_name}* சீட்டின் *மாதம் {current_month}* ஏல முடிவுகள்:

🥇 *வெற்றி பெற்றவர்:* {winner_name} ({winner_ticket})
💰 *ஏலத் தள்ளுபடி:* {winning_discount}
🎁 *கை இருப்பு சேமிப்பு:* {discount_pool_balance}
🗓️ *அடுத்த ஏலத் தேதி:* {next_auction_date}
📍 *நேரலை தளம்:* {live_bidding_link}

நன்றி!
*{organizer_name}*
📞 {organizer_phone}`;

const DEFAULT_POST_AUCTION_EN = `🏆 *Auction Summary — {chit_group_name}*
Dear Members! 🙏

Here is the live auction summary for *{chit_group_name} — Month {current_month}*:

🥇 *Winning Subscriber:* {winner_name} ({winner_ticket})
💰 *Winning Discount:* {winning_discount}
🎁 *Accumulated Discount Pool:* {discount_pool_balance}
🗓️ *Next Auction Date:* {next_auction_date}
📍 *View Passbook & Ledger:* {live_bidding_link}

Regards,
*{organizer_name}*
📞 {organizer_phone}`;

const DEFAULT_REMINDER_TA = `⏳ *சீட்டு தவணை நிலுவை நினைவூட்டல் — {chit_group_name}*
வணக்கம் உறுப்பினர்களே! 🙏

நமது *{chit_group_name}* சீட்டின் *மாதம் {current_month}* தவணை தொகைக்கான நினைவூட்டல்:

💰 *செலுத்த வேண்டிய தவணை:* {monthly_due}
🗓️ *ஏலத் தேதி:* {auction_date_time}

⚠️ *முக்கிய குறிப்பு:*
தவணை தொகையை குறித்த நேரத்தில் செலுத்தி சீட்டு நடவடிக்கைகள் தொய்வின்றி நடைபெற ஒத்துழைக்குமாறு அன்புடன் கேட்டுக்கொள்கிறோம்.

📍 *கணக்கு விவரங்களை சரிபார்க்க:* {live_bidding_link}

நன்றி!
*{organizer_name}*
📞 {organizer_phone}`;

const DEFAULT_REMINDER_EN = `⏳ *Monthly Installment Due Reminder — {chit_group_name}*
Dear Members! 🙏

This is a friendly reminder for the *Month {current_month}* installment of *{chit_group_name}*:

💰 *Monthly Due:* {monthly_due}
🗓️ *Auction Date:* {auction_date_time}

⚠️ *Important Note:*
Kindly clear your monthly installment dues in a timely manner prior to the live bidding session.

📍 *Check Passbook & Ledger:* {live_bidding_link}

Regards,
*{organizer_name}*
📞 {organizer_phone}`;

type TemplateCategory = 'pre-auction' | 'post-auction' | 'payment-reminder';

function renderWhatsAppFormatted(text: string) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, lIdx) => {
        if (!line.trim()) {
          return <div key={lIdx} className="h-1.5" />;
        }
        if (line.includes('━') || line.includes('───')) {
          return (
            <div key={lIdx} className="text-emerald-300/40 select-none font-mono text-[10px] tracking-tight py-0.5 leading-none">
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
                  <strong key={pIdx} className="font-bold text-slate-900">
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
  const { organizationName } = useOrganization();
  const [groupsMetadata, setGroupsMetadata] = useState<Record<string, GroupMetadata>>({});
  const [activeGroupKey, setActiveGroupKey] = useState<string>('');
  
  // Language & Template Mode State
  const [language, setLanguage] = useState<'en' | 'ta'>('ta'); // Default to Tamil
  const [templateType, setTemplateType] = useState<TemplateCategory>('pre-auction');
  const [copied, setCopied] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Cloud Sync Status: 'synced' | 'saving' | 'error'
  const [cloudSyncStatus, setCloudSyncStatus] = useState<'synced' | 'saving' | 'error'>('synced');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Templates Store (EN & TA)
  const [preAuctionEn, setPreAuctionEn] = useState<string>(DEFAULT_PRE_AUCTION_EN);
  const [postAuctionEn, setPostAuctionEn] = useState<string>(DEFAULT_POST_AUCTION_EN);
  const [reminderEn, setReminderEn] = useState<string>(DEFAULT_REMINDER_EN);

  const [preAuctionTa, setPreAuctionTa] = useState<string>(DEFAULT_PRE_AUCTION_TA);
  const [postAuctionTa, setPostAuctionTa] = useState<string>(DEFAULT_POST_AUCTION_TA);
  const [reminderTa, setReminderTa] = useState<string>(DEFAULT_REMINDER_TA);

  // Custom Dynamic Signature & Phone Line
  const [signatureLine, setSignatureLine] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return (
        localStorage.getItem('chit_broadcast_signature') ||
        organizationName ||
        (profile?.fullName ? `Dr. Kishor Anbazhakan (${profile.fullName})` : 'Dr. Kishor Anbazhakan (Kishor Chit Funds)')
      );
    }
    return organizationName || 'Dr. Kishor Anbazhakan (Kishor Chit Funds)';
  });

  const [contactPhone, setContactPhone] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('chit_broadcast_phone') || profile?.phoneNumber || '+91 99436 09010';
    }
    return profile?.phoneNumber || '+91 99436 09010';
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. Fetch Cloud Templates from Supabase public.system_settings
  const fetchCloudTemplates = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'broadcast_templates')
        .maybeSingle();

      if (data?.value) {
        const val = data.value;
        if (val.pre_auction_en) setPreAuctionEn(val.pre_auction_en);
        if (val.post_auction_en) setPostAuctionEn(val.post_auction_en);
        if (val.reminder_en) setReminderEn(val.reminder_en);

        if (val.pre_auction_ta) setPreAuctionTa(val.pre_auction_ta);
        if (val.post_auction_ta) setPostAuctionTa(val.post_auction_ta);
        if (val.reminder_ta) setReminderTa(val.reminder_ta);

        if (val.org_signature) setSignatureLine(val.org_signature);
        if (val.org_phone) setContactPhone(val.org_phone);

        setCloudSyncStatus('synced');
      } else {
        if (typeof window !== 'undefined') {
          const lPreEn = localStorage.getItem('chit_template_pre_en');
          const lPostEn = localStorage.getItem('chit_template_post_en');
          const lRemEn = localStorage.getItem('chit_template_rem_en');
          const lPreTa = localStorage.getItem('chit_template_pre_ta');
          const lPostTa = localStorage.getItem('chit_template_post_ta');
          const lRemTa = localStorage.getItem('chit_template_rem_ta');

          if (lPreEn) setPreAuctionEn(lPreEn);
          if (lPostEn) setPostAuctionEn(lPostEn);
          if (lRemEn) setReminderEn(lRemEn);
          if (lPreTa) setPreAuctionTa(lPreTa);
          if (lPostTa) setPostAuctionTa(lPostTa);
          if (lRemTa) setReminderTa(lRemTa);
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
    remEn: string,
    preTa: string,
    postTa: string,
    remTa: string,
    sig: string,
    phone: string
  ) => {
    try {
      setCloudSyncStatus('saving');
      const payload = {
        pre_auction_en: preEn,
        post_auction_en: postEn,
        reminder_en: remEn,
        pre_auction_ta: preTa,
        post_auction_ta: postTa,
        reminder_ta: remTa,
        org_signature: sig,
        org_phone: phone,
        updated_at: new Date().toISOString(),
      };

      if (typeof window !== 'undefined') {
        localStorage.setItem('chit_template_pre_en', preEn);
        localStorage.setItem('chit_template_post_en', postEn);
        localStorage.setItem('chit_template_rem_en', remEn);
        localStorage.setItem('chit_template_pre_ta', preTa);
        localStorage.setItem('chit_template_post_ta', postTa);
        localStorage.setItem('chit_template_rem_ta', remTa);
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

  const triggerDebouncedCloudSave = useCallback((
    preEn: string,
    postEn: string,
    remEn: string,
    preTa: string,
    postTa: string,
    remTa: string,
    sig: string,
    phone: string
  ) => {
    setCloudSyncStatus('saving');
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      persistToCloud(preEn, postEn, remEn, preTa, postTa, remTa, sig, phone);
    }, 800);
  }, [persistToCloud]);

  useEffect(() => {
    fetchCloudTemplates();
  }, [fetchCloudTemplates]);

  // Fetch active chit groups, members, collections, and auction logs from Supabase
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

        // Fetch group memberships
        const { data: membersData } = await supabase
          .from('group_members')
          .select('group_id, profile_id, ticket_number');

        // Fetch collections to count unpaid subscribers
        const { data: collectionsData } = await supabase
          .from('transactions')
          .select('chit_group_id, member_id, month, type')
          .eq('type', 'collection');

        groupsData.forEach((g: any) => {
          const totalVal = Number(g.total_value) || 200000;
          const memberCount = Number(g.member_count) || Number(g.duration_months) || 20;
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
          const formattedTime = formatTime12h(g.next_auction_time || g.auction_time || '19:00');
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

          // Calculate unpaid members for this month
          const groupMembersList = (membersData || []).filter((m: any) => m.group_id === g.id);
          const paidMemberIds = new Set(
            (collectionsData || [])
              .filter((t: any) => t.chit_group_id === g.id && Number(t.month) === currentM)
              .map((t: any) => t.member_id)
          );
          const unpaidCount = Math.max(0, groupMembersList.length - paidMemberIds.size);

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
            auctionTime: g.auction_time || '19:00',
            nextAuctionDate: g.next_auction_date || '',
            nextAuctionTime: g.next_auction_time || '19:00',
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
            unpaidCount: unpaidCount,
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
      if (templateType === 'pre-auction') return preAuctionTa;
      if (templateType === 'post-auction') return postAuctionTa;
      return reminderTa;
    }
    if (templateType === 'pre-auction') return preAuctionEn;
    if (templateType === 'post-auction') return postAuctionEn;
    return reminderEn;
  }, [language, templateType, preAuctionEn, postAuctionEn, reminderEn, preAuctionTa, postAuctionTa, reminderTa]);

  const handleTemplateChange = (val: string) => {
    if (language === 'ta') {
      if (templateType === 'pre-auction') {
        setPreAuctionTa(val);
        triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, reminderEn, val, postAuctionTa, reminderTa, signatureLine, contactPhone);
      } else if (templateType === 'post-auction') {
        setPostAuctionTa(val);
        triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, reminderEn, preAuctionTa, val, reminderTa, signatureLine, contactPhone);
      } else {
        setReminderTa(val);
        triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, reminderEn, preAuctionTa, postAuctionTa, val, signatureLine, contactPhone);
      }
    } else {
      if (templateType === 'pre-auction') {
        setPreAuctionEn(val);
        triggerDebouncedCloudSave(val, postAuctionEn, reminderEn, preAuctionTa, postAuctionTa, reminderTa, signatureLine, contactPhone);
      } else if (templateType === 'post-auction') {
        setPostAuctionEn(val);
        triggerDebouncedCloudSave(preAuctionEn, val, reminderEn, preAuctionTa, postAuctionTa, reminderTa, signatureLine, contactPhone);
      } else {
        setReminderEn(val);
        triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, val, preAuctionTa, postAuctionTa, reminderTa, signatureLine, contactPhone);
      }
    }
  };

  const handleSignatureChange = (val: string) => {
    setSignatureLine(val);
    triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, reminderEn, preAuctionTa, postAuctionTa, reminderTa, val, contactPhone);
  };

  const handlePhoneChange = (val: string) => {
    setContactPhone(val);
    triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, reminderEn, preAuctionTa, postAuctionTa, reminderTa, signatureLine, val);
  };

  const handleResetDefaultTemplate = () => {
    const catLabel = templateType === 'pre-auction' ? 'Pre-Auction' : templateType === 'post-auction' ? 'Post-Auction' : 'Payment Reminder';
    if (confirm(`Reset the current ${language === 'ta' ? 'Tamil' : 'English'} ${catLabel} template to standard default?`)) {
      if (language === 'ta') {
        if (templateType === 'pre-auction') {
          setPreAuctionTa(DEFAULT_PRE_AUCTION_TA);
          triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, reminderEn, DEFAULT_PRE_AUCTION_TA, postAuctionTa, reminderTa, signatureLine, contactPhone);
        } else if (templateType === 'post-auction') {
          setPostAuctionTa(DEFAULT_POST_AUCTION_TA);
          triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, reminderEn, preAuctionTa, DEFAULT_POST_AUCTION_TA, reminderTa, signatureLine, contactPhone);
        } else {
          setReminderTa(DEFAULT_REMINDER_TA);
          triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, reminderEn, preAuctionTa, postAuctionTa, DEFAULT_REMINDER_TA, signatureLine, contactPhone);
        }
      } else {
        if (templateType === 'pre-auction') {
          setPreAuctionEn(DEFAULT_PRE_AUCTION_EN);
          triggerDebouncedCloudSave(DEFAULT_PRE_AUCTION_EN, postAuctionEn, reminderEn, preAuctionTa, postAuctionTa, reminderTa, signatureLine, contactPhone);
        } else if (templateType === 'post-auction') {
          setPostAuctionEn(DEFAULT_POST_AUCTION_EN);
          triggerDebouncedCloudSave(preAuctionEn, DEFAULT_POST_AUCTION_EN, reminderEn, preAuctionTa, postAuctionTa, reminderTa, signatureLine, contactPhone);
        } else {
          setReminderEn(DEFAULT_REMINDER_EN);
          triggerDebouncedCloudSave(preAuctionEn, postAuctionEn, DEFAULT_REMINDER_EN, preAuctionTa, postAuctionTa, reminderTa, signatureLine, contactPhone);
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
      const val = v.getValue(selectedMeta, signatureLine, contactPhone, language);
      const regexCurlySingle = new RegExp(`\\{${v.key}\\}`, 'gi');
      const regexCurlyDouble = new RegExp(`\\{\\{${v.key}\\}\\}`, 'gi');
      const regexAngle = new RegExp(`<${v.key}>`, 'gi');

      result = result
        .replace(regexCurlyDouble, val)
        .replace(regexCurlySingle, val)
        .replace(regexAngle, val);
    });

    return result;
  }, [activeRawTemplate, selectedMeta, signatureLine, contactPhone, language]);

  // Insert any text / emoji / tag into textarea at cursor position
  const insertTextAtCursor = (insertedText: string) => {
    triggerHapticFeedback('light');
    const textarea = textareaRef.current;

    if (textarea) {
      const cursorPos = textarea.selectionStart || 0;
      const end = textarea.selectionEnd || cursorPos;
      const text = activeRawTemplate;

      const updated = text.substring(0, cursorPos) + insertedText + text.substring(end);
      handleTemplateChange(updated);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(cursorPos + insertedText.length, cursorPos + insertedText.length);
      }, 50);
    } else {
      handleTemplateChange(activeRawTemplate + ' ' + insertedText);
    }
  };

  const wrapSelectedText = (delimiter: string) => {
    triggerHapticFeedback('light');
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || 0;
    const text = activeRawTemplate;
    if (start !== end) {
      const selected = text.substring(start, end);
      const updated = text.substring(0, start) + `${delimiter}${selected}${delimiter}` + text.substring(end);
      handleTemplateChange(updated);
    } else {
      insertTextAtCursor(`${delimiter}sample${delimiter}`);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(compiledBroadcastText);
    setCopied(true);
    triggerHapticFeedback('success');
    if (onAddAuditLog) {
      onAddAuditLog(`Copied broadcast text for ${selectedMeta?.name || 'group'}`);
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const formatWhatsAppUrl = () => {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(compiledBroadcastText)}`;
  };

  const formatSmsUrl = () => {
    return `sms:?body=${encodeURIComponent(compiledBroadcastText)}`;
  };

  const laabaSeetuPercentage = useMemo(() => {
    if (!selectedMeta || selectedMeta.totalValue <= 0) return 40.5;
    return Math.min(100, (selectedMeta.kaiIruppuPool / selectedMeta.totalValue) * 100);
  }, [selectedMeta]);

  return (
    <div className="w-full bg-slate-50 min-h-screen text-slate-800 antialiased flex flex-col font-sans">
      
      {/* ── TOP HEADER: EXACT STITCH DESKTOP SPEC ── */}
      <header className="h-16 bg-white border-b border-slate-200/80 px-6 sm:px-8 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-base sm:text-lg font-bold font-display text-slate-900 tracking-tight whitespace-nowrap">
              Communication &amp; WhatsApp Broadcast Center
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 whitespace-nowrap flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              WhatsApp API Ready
            </span>
          </div>
        </div>

        {/* Header Right: Quick Status & Send Trigger */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/70">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 2C6.495 2 2 6.495 2 12.031c0 1.97.57 3.81 1.558 5.372L2.5 22l4.808-1.047a9.98 9.98 0 0 0 4.723 1.18c5.536 0 10.031-4.496 10.031-10.032S17.567 2 12.031 2z"></path></svg>
            <span>Broadcasting from: <strong className="text-slate-800">{contactPhone}</strong></span>
          </div>
          <button 
            type="button"
            onClick={() => window.open(formatWhatsAppUrl(), '_blank')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-sm shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"></path></svg>
            <span>Send via WhatsApp (1-Tap)</span>
          </button>
        </div>
      </header>

      {/* ── WORKSPACE BODY ── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="w-full max-w-[1550px] mx-auto space-y-5">

          {/* 1. CHIT GROUP SELECTOR & STATUS STRIP */}
          <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              
              {/* Chit Group Selector Dropdown */}
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="chit-group-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex-shrink-0">
                  Select Group:
                </label>
                <div className="relative min-w-[280px] sm:min-w-[340px]">
                  <select 
                    id="chit-group-select" 
                    value={activeGroupKey}
                    onChange={(e) => {
                      setActiveGroupKey(e.target.value);
                      triggerHapticFeedback('light');
                    }}
                    className="w-full appearance-none bg-white border border-slate-200/80 rounded-xl px-3.5 py-2 pr-9 text-xs font-semibold text-slate-800 shadow-xs focus:outline-none focus:ring-brand-500 focus:border-brand-500 cursor-pointer transition-all"
                  >
                    {Object.values(groupsMetadata).map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} — {formatINR(group.totalValue)} ({group.memberCount} Slots • Month {group.currentMonth} of {group.durationMonths})
                      </option>
                    ))}
                    {Object.keys(groupsMetadata).length === 0 && (
                      <option value="">Sample Test Group — ₹1,00,000 (5 Slots • Month 2 of 5)</option>
                    )}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                  </div>
                </div>
              </div>

              {/* Key Quick Details of Selected Group */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {selectedMeta && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="font-semibold text-slate-700">Installment:</span>
                    <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                      {formatINR(selectedMeta.fixedInstallment)}
                    </span>
                  </div>
                )}

                {/* Laaba Seetu Special Badge */}
                <div className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-50 to-emerald-50 text-amber-800 rounded-xl border border-amber-200/80 font-bold shadow-2xs">
                  <span>🎉</span>
                  <span>Kai Iruppu: <strong>{formatINR(selectedMeta?.kaiIruppuPool || 40500)}</strong></span>
                  <span className="text-[10px] bg-amber-200/60 text-amber-900 px-1.5 py-0.5 rounded font-semibold">
                    {laabaSeetuPercentage.toFixed(1)}% to Laaba Seetu
                  </span>
                </div>
              </div>

            </div>
          </section>

          {/* 2. BROADCAST CATEGORIES & BILINGUAL SWITCHER TOOLBAR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            {/* 3 Categories */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold overflow-x-auto">
              <button 
                type="button"
                onClick={() => {
                  setTemplateType('pre-auction');
                  triggerHapticFeedback('light');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  templateType === 'pre-auction'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📢</span>
                <span>1. Pre-Auction Announcement</span>
              </button>
              
              <button 
                type="button"
                onClick={() => {
                  setTemplateType('post-auction');
                  triggerHapticFeedback('light');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  templateType === 'post-auction'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏆</span>
                <span>2. Post-Auction Summary</span>
              </button>
              
              <button 
                type="button"
                onClick={() => {
                  setTemplateType('payment-reminder');
                  triggerHapticFeedback('light');
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  templateType === 'payment-reminder'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>⏳</span>
                <span>3. Payment Reminder / Dues</span>
                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full font-bold">
                  {selectedMeta?.unpaidCount ?? 4} Unpaid
                </span>
              </button>
            </div>

            {/* Bilingual Toggle Switcher & Reset Button */}
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:inline">
                Template Language:
              </span>
              <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/70 text-xs font-bold">
                <button 
                  type="button"
                  onClick={() => {
                    setLanguage('ta');
                    triggerHapticFeedback('light');
                  }}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    language === 'ta'
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🇮🇳 தமிழ் (Tamil)</span>
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setLanguage('en');
                    triggerHapticFeedback('light');
                  }}
                  className={`px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                    language === 'en'
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>English</span>
                </button>
              </div>
              <button 
                type="button"
                onClick={handleResetDefaultTemplate}
                className="p-1.5 rounded-xl text-slate-400 hover:text-brand-600 hover:bg-slate-100 transition-colors cursor-pointer" 
                title="Reset to verified standard template"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
              </button>
            </div>
          </div>

          {/* 3. DUAL-PANE WORKSPACE: LEFT EDITOR (7 COLS) + RIGHT LIVE WHATSAPP BUBBLE PREVIEW (5 COLS) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* LEFT PANE: TEMPLATE EDITOR & DYNAMIC PLACEHOLDERS (7 COLS) */}
            <section className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
              
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 flex items-center gap-2">
                    <span>Template Composer &amp; Placeholders</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                      cloudSyncStatus === 'synced'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : cloudSyncStatus === 'saving'
                        ? 'bg-indigo-50 text-brand-700 border-brand-200 animate-pulse'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {cloudSyncStatus === 'synced' ? 'Dynamic Synced' : cloudSyncStatus === 'saving' ? 'Saving...' : 'Local'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">Click any chip to inject real-time database variables directly into your message text.</p>
                </div>
                <button 
                  type="button"
                  onClick={handleResetDefaultTemplate}
                  className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                  <span>Reset Default</span>
                </button>
              </div>

              {/* Dynamic Placeholders Insertion Toolbar */}
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-500 block mb-1.5 tracking-wider">
                  Click to Insert Dynamic Placeholder Tags:
                </label>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {[
                    { tag: '{chit_group_name}', label: '{chit_group_name}' },
                    { tag: '{current_month}', label: '{current_month}' },
                    { tag: '{auction_date_time}', label: '{auction_date_time}' },
                    { tag: '{monthly_due}', label: '{monthly_due}' },
                    { tag: '{discount_pool_balance}', label: '{discount_pool_balance}' },
                    { tag: '{live_bidding_link}', label: '{live_bidding_link}' },
                    { tag: '{organizer_name}', label: '{organizer_name}' },
                    { tag: '{organizer_phone}', label: '{organizer_phone}' },
                    { tag: '{winner_name}', label: '{winner_name}' },
                    { tag: '{winning_discount}', label: '{winning_discount}' },
                    { tag: '{total_chit_value}', label: '{total_chit_value}' },
                  ].map((chip) => (
                    <button
                      key={chip.tag}
                      type="button"
                      onClick={() => insertTextAtCursor(chip.tag)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-brand-700 border border-brand-200/70 font-semibold transition-all cursor-pointer active:scale-95"
                    >
                      <span>+</span> {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoji & Text Formatting Bar */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Chit Emojis:</span>
                  {['📢', '💰', '🏆', '🎉', '🗓️', '⏰', '📍', '✅', '⚠️'].map((emoji) => (
                    <button 
                      key={emoji}
                      type="button"
                      onClick={() => insertTextAtCursor(emoji)}
                      className="p-1 rounded hover:bg-white text-base transition-transform hover:scale-110 active:scale-90 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                  <button 
                    type="button"
                    onClick={() => wrapSelectedText('*')}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    *bold*
                  </button>
                  <button 
                    type="button"
                    onClick={() => wrapSelectedText('_')}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 italic hover:bg-slate-100 cursor-pointer"
                  >
                    _italic_
                  </button>
                  <button 
                    type="button"
                    onClick={() => wrapSelectedText('~')}
                    className="px-1.5 py-0.5 rounded bg-white border border-slate-200 line-through hover:bg-slate-100 cursor-pointer"
                  >
                    ~strike~
                  </button>
                </div>
              </div>

              {/* Template Raw Text Area */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Message Content (Raw Markdown/WhatsApp Text):</label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Characters: {activeRawTemplate.length} · WhatsApp Compliant
                  </span>
                </div>
                <textarea 
                  ref={textareaRef}
                  rows={11} 
                  value={activeRawTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 text-slate-800 focus:bg-white focus:ring-brand-500 focus:border-brand-500 leading-relaxed transition-all shadow-inner resize-none"
                  placeholder="Type or customize your broadcast template..."
                />
              </div>

              {/* 4. ORGANIZER SIGNATURE & SENDER SETTINGS */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    <span>Organization Signature &amp; Custom Sender Details</span>
                  </h4>
                  <span className="text-[10px] text-slate-400 font-medium">Auto-populates {'{organizer_name}'}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Organizer / Firm Signature Name:</label>
                    <input 
                      type="text" 
                      value={signatureLine}
                      onChange={(e) => handleSignatureChange(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-medium text-slate-800 focus:ring-brand-500 focus:border-brand-500 shadow-2xs" 
                      placeholder="Dr. Kishor Anbazhakan"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">Official WhatsApp Phone Number:</label>
                    <input 
                      type="text" 
                      value={contactPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-mono text-slate-800 focus:ring-brand-500 focus:border-brand-500 shadow-2xs"
                      placeholder="+91 99436 09010"
                    />
                  </div>
                </div>
              </div>

            </section>

            {/* RIGHT PANE: REALISTIC LIVE WHATSAPP BUBBLE PREVIEW (5 COLS) */}
            <aside className="lg:col-span-5 space-y-4">
              
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                    <h3 className="font-display font-bold text-sm text-slate-900">Live WhatsApp Chat Bubble Preview</h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full font-mono">
                    WYSIWYG
                  </span>
                </div>
                <p className="text-xs text-slate-500">This simulates the exact visual layout your subscribers will receive inside WhatsApp on Android/iOS.</p>
              </div>

              {/* WhatsApp Mobile Mockup Container */}
              <div className="rounded-3xl shadow-xl overflow-hidden border border-slate-300/80 bg-slate-900 flex flex-col">
                
                {/* WhatsApp Chat Header */}
                <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-2.5">
                    <svg className="w-4 h-4 text-slate-200 cursor-pointer" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"></path></svg>
                    <div className="w-9 h-9 rounded-full bg-emerald-700 border border-emerald-500/50 flex items-center justify-center font-bold text-sm shadow-inner font-display">
                      CF
                    </div>
                    <div>
                      <h4 className="text-xs font-bold leading-tight flex items-center gap-1.5">
                        <span>{selectedMeta?.name || 'Sample Test Group'}</span>
                        <svg className="w-3 h-3 text-emerald-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                      </h4>
                      <p className="text-[10px] text-emerald-200">
                        {selectedMeta?.memberCount || 20} participants · {signatureLine.split(' ')[0] || 'Dr. Kishor'}, +{(selectedMeta?.memberCount || 20) - 1}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 text-slate-200">
                    <svg className="w-4 h-4 cursor-pointer" fill="currentColor" viewBox="0 0 20 20"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z"></path></svg>
                    <svg className="w-4 h-4 cursor-pointer" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                  </div>
                </div>

                {/* WhatsApp Chat Surface (Doodle Pattern) */}
                <div 
                  style={{
                    backgroundColor: '#ECE5DD',
                    backgroundImage: 'radial-gradient(#d3c6b6 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                  className="p-4 flex-1 flex flex-col justify-end space-y-3 min-h-[390px]"
                >
                  
                  {/* Date Pill */}
                  <div className="flex justify-center">
                    <span className="bg-white/80 backdrop-blur-sm text-[10px] font-bold text-slate-600 px-3 py-0.5 rounded-full shadow-2xs">
                      {language === 'ta' ? 'இன்று (Today)' : 'Today'}
                    </span>
                  </div>

                  {/* Live Chat Bubble (Rendered WhatsApp Style) */}
                  <div className="self-end max-w-[95%] bg-[#DCF8C6] rounded-2xl rounded-tr-xs p-3.5 shadow-sm text-slate-900 border border-emerald-200/60 relative">
                    
                    {/* Message Body with Simulated WhatsApp Styling */}
                    <div className="text-xs leading-relaxed space-y-2 text-slate-800">
                      {renderWhatsAppFormatted(compiledBroadcastText)}
                    </div>

                    {/* Bubble Timestamp & WhatsApp Double Checkmarks */}
                    <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-slate-500 font-mono">
                      <span>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      <svg className="w-3.5 h-3.5 text-blue-500 inline" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.5 4.5a.5.5 0 0 0-.708-.708L5 10.293 3.854 9.146a.5.5 0 0 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0l2.5-2.5z"></path>
                      </svg>
                    </div>
                  </div>

                </div>

                {/* Fake Input Bar */}
                <div className="bg-[#F0F2F5] px-3 py-2 flex items-center gap-2 border-t border-slate-200">
                  <div className="w-7 h-7 rounded-full bg-slate-300 text-slate-600 flex items-center justify-center text-xs">😊</div>
                  <div className="flex-1 bg-white rounded-full py-1.5 px-3 text-xs text-slate-400">Message ready for transmission...</div>
                  <button 
                    type="button"
                    onClick={() => window.open(formatWhatsAppUrl(), '_blank')}
                    className="w-8 h-8 rounded-full bg-[#128C7E] hover:bg-emerald-700 active:scale-95 text-white flex items-center justify-center text-xs shadow transition-all cursor-pointer"
                    title="Send via WhatsApp"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path></svg>
                  </button>
                </div>

              </div>

              {/* 5. ONE-CLICK DISPATCH ACTIONS & STATUS BAR */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-2.5">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">One-Click Dispatch Actions:</h4>
                
                <button 
                  type="button"
                  onClick={() => window.open(formatWhatsAppUrl(), '_blank')}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"></path></svg>
                  <span>Launch WhatsApp &amp; Send Pre-filled Message</span>
                </button>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button 
                    type="button"
                    onClick={handleCopyText}
                    className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-98"
                  >
                    {copied ? (
                      <Check size={14} className="text-emerald-600" />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    )}
                    <span>{copied ? 'Copied!' : 'Copy Formatted Text'}</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => window.open(formatSmsUrl(), '_blank')}
                    className="py-2 px-3 bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-brand-200/60 cursor-pointer active:scale-98"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    <span>Send SMS Broadcast</span>
                  </button>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 text-center truncate">
                  <span>Direct deep-link integration: <code className="font-mono text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[10px]">https://api.whatsapp.com/send?text=...</code></span>
                </div>
              </div>

            </aside>

          </div>

        </div>
      </main>
    </div>
  );
}
