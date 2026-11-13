/**
 * Standard Receipt Numbering & Extraction Utility for Chit Funds Manager
 * 
 * Standard Format: RCP-YYYYMMDD-HHMM-XXXX
 * - RCP: Standard payment receipt prefix
 * - YYYYMMDD: 8-digit date string (e.g. 20261113 for 13 Nov 2026)
 * - HHMM: 4-digit 24-hour timestamp (e.g. 1705 for 05:05 PM)
 * - XXXX: 4-character unambiguous uppercase alphanumeric token 
 *   (drawn strictly from 23456789ABCDEFGHJKLMNPQRSTUVWXYZ, eliminating 0/O and 1/I confusion)
 * 
 * Example: RCP-20261113-1705-4B92
 */

const UNAMBIGUOUS_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a unique, standardized, and unambiguous receipt number.
 */
export function generateReceiptNumber(customDate?: Date): string {
  const d = customDate || new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  let salt = '';
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * UNAMBIGUOUS_CHARS.length);
    salt += UNAMBIGUOUS_CHARS[idx];
  }

  return `RCP-${year}${month}${day}-${hours}${minutes}-${salt}`;
}

/**
 * Extracts the official receipt number from a transaction row or notes string.
 * Supports standard batch tags [Batch:RCP-...], simple [RCP-...], legacy [Batch:BATCH-...],
 * and deterministically derives a clean receipt number for legacy transactions without tags.
 */
export function extractReceiptNumber(tx: { notes?: string | null; id?: string; created_at?: string } | null | undefined): string {
  if (!tx) return 'RCP-UNKNOWN';
  const notes = tx.notes || '';

  // 1. Check for standard batch tag in notes: [Batch:RCP-...] or [RCP-...]
  const rcpMatch = notes.match(/\[(?:Batch:)?(RCP-[A-Za-z0-9_-]+)(?:\|[^\]]*)?\]/i);
  if (rcpMatch && rcpMatch[1]) {
    return rcpMatch[1].toUpperCase();
  }

  // 2. Check for BATCH- tag: [Batch:BATCH-...]
  const batchMatch = notes.match(/\[(?:Batch:)?(BATCH-[A-Za-z0-9_-]+)(?:\|[^\]]*)?\]/i);
  if (batchMatch && batchMatch[1]) {
    return batchMatch[1].toUpperCase();
  }

  // 3. Check for bare RCP- pattern anywhere in notes
  const bareMatch = notes.match(/\b(RCP-[A-Za-z0-9_-]+)\b/i);
  if (bareMatch && bareMatch[1]) {
    return bareMatch[1].toUpperCase();
  }

  // 4. Deterministic fallback for legacy records without embedded receipt numbers:
  // Derived from transaction created date + first 6 chars of transaction UUID
  if (tx.id) {
    const d = tx.created_at ? new Date(tx.created_at) : new Date();
    const yyyymmdd = !isNaN(d.getTime()) 
      ? d.toISOString().slice(0, 10).replace(/-/g, '')
      : 'LEGACY';
    const cleanId = String(tx.id).replace(/-/g, '').slice(0, 6).toUpperCase();
    return `RCP-${yyyymmdd}-${cleanId}`;
  }

  return 'RCP-PENDING';
}

