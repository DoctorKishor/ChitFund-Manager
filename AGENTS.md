# Chit Funds Manager — System Specification & Agent Guidelines

## 1. Executive Domain Overview
This repository contains a full-stack **Chit Funds Management System** designed for high-trust family-run and community chit funds. The system tracks member enrollments, live auction sessions, dividend distributions, multi-account treasury balances, and physical ledger reconciliations.

---

## 2. Core Business Rules & Chit Mechanics

### A. Group Setup & Parameters
- **Duration = Member Count**: If a chit group runs for 20 months, it must have exactly 20 member tickets.
- **Fixed Installment**: Baseline monthly due per member is:
  $$\text{Monthly Installment} = \frac{\text{Total Chit Value}}{\text{Member Count}}$$
  *Example*: A ₹2,00,000 chit with 20 members has a monthly installment of **₹10,000** per member.

---

### B. Month 0: Launch Month (**Organizer Profit**)
- **Definition**: The launch month (Month 0) is reserved exclusively for the **Organizer**.
- **Collection**: All 20 members pay their first month installment (₹10,000 × 20 = ₹2,00,000).
- **Auction**: **No auction takes place in Month 0.**
- **Allocation**: The entire ₹2,00,000 collected pool is taken by the **Organizer** as **Organizer Profit**.
- **State Transition**: Upon confirmation of launch collections, the chit group advances to **Month 1**.

---

### C. Months 1 to N: Regular Monthly Auction Cycles
1. **Installment Collection**: Each member owes the monthly installment (₹10,000).
2. **Live Bidding**: Eligible members (who have not yet won an auction in previous months) shout bids representing the discount they are willing to forfeit.
3. **Winner Payout**:
   $$\text{Winner Net Payout} = \text{Total Chit Value} - \text{Winning Discount Bid}$$
   *Example*: If Member A bids ₹30,000, Member A receives ₹1,70,000 net payout and is marked as *Already Won*.
4. **Discount Pool Accumulation**:
   - The winning discount amount (e.g., ₹30,000 in Month 1, ₹35,000 in Month 2) accumulates into the group's **Accumulated Discount Pool** (`kai_iruppu_pool`).
   - Running pool: ₹30,000 + ₹35,000 = ₹65,000.

---

### D. Laaba Seetu (லாப சீட்டு — Profit Month for Members)
- **What is Laaba Seetu?**
  *"Laabam"* in Tamil means **Profit**. Laaba Seetu is a **bonus profit month for the subscribers**.
- **Trigger Condition**:
  $$\text{Accumulated Discount Pool } (\text{kai\_iruppu\_pool}) \ge \text{Total Chit Value } (₹2,00,000)$$
- **How Laaba Seetu Operates**:
  1. **₹0 Installment Due for Members**:
     - All 20 subscribers **DO NOT PAY** their monthly installment (Installment due = ₹0).
     - The monthly prize pot of ₹2,00,000 is completely funded by the previously accumulated discount pool.
  2. **Regular Auction Continues**:
     - An auction is **still conducted** among eligible non-winning members as usual.
     - The winning bidder receives their calculated net payout (`₹2,00,000 - winning bid`).
     - *Example*: If Member C bids ₹20,000 in the Laaba Seetu month, Member C receives ₹1,80,000 net payout and is marked as *Already Won*.
  3. **Discount Pool Rollover & Continuous Accumulation**:
     - The previously accumulated ₹2,00,000 pool is deducted to fund the prize pot.
     - **The winning bid discount from this Laaba Seetu month (e.g., ₹20,000) is immediately credited to the new Discount Pool (`kai_iruppu_pool`)**.
     - Running pool for next month becomes:
       $$\text{New Pool} = (\text{Old Pool} - \text{Total Chit Value}) + \text{This Month's Winning Discount} = (₹2,00,000 - ₹2,00,000) + ₹20,000 = ₹20,000$$
     - Subsequent regular months' auction discounts accumulate onto this ₹20,000 towards future Laaba Seetu cycles.

---

## 3. Financial Treasury & Multi-Wallet Architecture

The system maintains 4 distinct operational vaults synchronized in real-time with Supabase (`global_treasury`):
1. **`cash_in_hand`** (Physical Cash Box): Physical currency collected directly from members or held on-site.
2. **`kishor_bank`** (Kishor Bank Account): Primary digital account for UPI / NetBanking collections.
3. **`dad_bank`** (Dad Bank Account): Secondary banking channel for auction disbursements.
4. **`mom_bank`** (Mom Bank Account): Tertiary account for cheques and backup reserves.

### Treasury Rules:
- **No Negative Balances**: Balances must never silently become negative. All payouts and relocations must validate sufficient funds.
- **Relocations (ATM / Bank-to-Cash)**: Moving funds from a bank account to the Cash Box requires physical verification before the cash box balance is credited.
- **Personal Spends / Draws**: Deducted directly from `cash_in_hand` with tags (Petrol, Maintenance, etc.) and logged with admin attribution.

---

## 4. User Roles & Access Hierarchy

1. **Admin (`admin`)**: Full access to all tabs (Dashboard, Chits, Members, Auctions, Reports, Cash Handling), group creation, payouts, and database configuration.
2. **Manager (`manager`)**: Operational access to member matrix, collections logging, live bidding engine, and cash ledger. Cannot delete profiles or alter global security settings.
3. **Subscriber (`subscriber`)**: Read-only portal to view enrolled tickets, auction schedules, personal payment ledger, and dividend statements. Restricted from Cash Handling and admin configuration tabs.

---

## 5. Technical Specifications & Architecture

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Lucide Icons.
- **Backend / Database**: Supabase (PostgreSQL 15+).
- **Authentication**: Supabase Auth (Email / Password).
- **State Management**:
  - `AuthContext.tsx`: Supabase session & user profile.
  - `WalletContext.tsx`: Real-time treasury balances (`global_treasury`) via Supabase Realtime channel.
- **Database Tables**:
  - `profiles`: User IDs, roles, names, phone numbers.
  - `chit_groups`: Group parameters, total value, duration, current month, `kai_iruppu_pool`.
  - `group_members`: Enrolled tickets, winner status, physical book sync status.
  - `global_treasury`: 4 wallet balance rows with realtime publication enabled.
  - `transactions`: Complete transaction ledger (collections, payouts, personal draws, transfers).
  - `auction_logs`: Historical bidding logs per month and winner records.
  - `security_audit_logs`: Immutable administrative audit trail.

---

## 6. Development & Agent Behavior Guidelines

1. **NO Mock Data or Sandbox Widgets**: Never reintroduce fake simulation buttons, dummy profile switchers, or hardcoded group arrays. All UI components must read and write to Supabase.
2. **Terminology Accuracy**:
   - Use **"Organizer Profit"** (not company commission) for Month 0.
   - Use **"Laaba Seetu"** strictly for the member-profit free installment mechanism.
3. **Database Integrity**: Always enforce PostgreSQL constraints, foreign keys, and Row-Level Security (RLS) policies.
4. **Build Verification**: Always run `npm run build` to verify zero TypeScript errors before committing changes.
