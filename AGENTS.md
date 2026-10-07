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

---

## 7. Master System Audit & Fine-Tuning / Debugging Directive

Whenever an AI agent is requested to audit, debug, fine-tune, or add features to this application, it MUST execute the following verification checklist:

### A. Supabase PostgreSQL & Schema Synchronization Audit
1. **Schema & Column Parity**:
   - Inspect `information_schema.columns` across all core tables (`chit_groups`, `group_members`, `profiles`, `transactions`, `auction_logs`, `global_treasury`, `security_audit_logs`).
   - Ensure every column referenced, queried, inserted, or updated in the frontend (e.g. `notes`, `group_member_id`, `start_date`, `split_pool`, `custom_installment`, `exit_month`, `transferred_from`) exists in the live PostgreSQL database.
2. **Check Constraints & Enums**:
   - Verify `chit_groups.current_month >= 0` (MUST allow `0` for Launch / Orientation Month).
   - Verify `auction_logs.month >= 0`.
   - Verify enum check constraints:
     - `global_treasury.wallet_type IN ('cash_in_hand', 'kishor_bank', 'dad_bank', 'mom_bank')`
     - `transactions.type IN ('collection', 'payout', 'personal_draw', 'atm_withdrawal', 'transfer')`
     - `chit_groups.status IN ('draft', 'active', 'completed')`
3. **Foreign Keys & Nullability**:
   - Ensure `transactions.profile_id` and `transactions.created_by` permit `NULL` or have fallback defaults (`auth.uid()`) to prevent crashes during offline / manual subscriber operations.
4. **Row-Level Security (RLS) & Triggers**:
   - Ensure `is_admin_or_manager()` security definer functions permit required `SELECT`, `INSERT`, and `UPDATE` operations.
   - Verify `process_audit_log()` triggers fire smoothly on data mutations without throwing constraint violations.

### B. Chit Funds Business Rules & Math Integrity
1. **Month 0 vs Month 1 Separation**:
   - **Month 0**: Launch & Orientation month (`startDate + 0`). No live auction is held. All collections are allocated as **Organizer Profit**.
   - **Month 1**: 1st Live Auction month (`startDate + 1`). Eligible members place discount bids.
   - **Months 2..N**: Subsequent consecutive monthly auctions (`startDate + 2..N`).
2. **Live Auction Bidding & Payouts**:
   - Winner Net Payout = $\text{Total Chit Value} - \text{Winning Discount Bid}$.
   - The winning discount accumulates into `kai_iruppu_pool`.
3. **Laaba Seetu (லாப சீட்டு) Mechanics**:
   - Triggers when `kai_iruppu_pool >= Total Chit Value`.
   - In a Laaba Seetu month: Member due = **₹0**. Auction is still held.
   - Winning discount from the Laaba Seetu month immediately starts the new discount pool:
     $$\text{New Pool} = (\text{Old Pool} - \text{Total Chit Value}) + \text{This Month's Winning Discount}$$

### C. Multi-Wallet Treasury & State Flow Audit
1. **Delta vs Absolute Balance Updates**:
   - In `useWallet().updateBalance(wallet, amount)`, verify `amount` is ALWAYS treated as a **delta** (e.g. `+amt` or `-amt`), NEVER as `currentBal + amt` (which would cause double-counting).
2. **4 Operational Vaults**:
   - Ensure synchronization across `cash_in_hand`, `kishor_bank`, `dad_bank`, and `mom_bank`.
   - Ensure ATM relocations use the two-step verification workflow (bank debit $\rightarrow$ pending verification $\rightarrow$ physical cash box credit).
3. **Zero Mock Data Policy**:
   - Verify that NO fake demo toggles, hardcoded member arrays, or mock simulation buttons exist in the UI. All cards must read/write to Supabase.

### D. Verification & Execution Protocol
1. Inspect the live Supabase database using MCP tools or SQL scripts.
2. If any schema disparity is found, execute the necessary DDL migration in Supabase and update `supabase_schema.sql`.
3. If any frontend state or math disparity is found, fix the component code.
4. Run `npm run build` at repository root to ensure **0 TypeScript / compilation errors**.
5. Commit and push all synchronized changes to GitHub `main`.

---

## 8. UI/UX Design System & MCP Visual Overhaul Protocol

### A. End-to-End Visual Overhaul Pipeline
To eliminate generic/cluttered UI ("AI slop") and elevate the application to institutional-grade fintech aesthetics without breaking existing Supabase business logic, the team utilizes a 6-step round-trip visual workflow:

```
[ Local Web App (localhost:3000) ]
       │
       ▼ (1. html.to.design Chrome Extension)
[ Figma Project (EjxNYmDhbpjq9Es9QKS9u3) ] ── (Full scroll capture)
       │
       ▼ (2. Export Frame as PNG)
[ Google Stitch (Project 16235470526146286805) ]
       │
       ▼ (3. Stitch AI Generative Overhaul using user credits)
[ Redesigned Screen in Stitch (HTML + Design System) ]
       │
       ▼ (4. Stitch "Export to Figma" ➔ Real Vector Layers & Components)
[ Figma Final Canvas (EjxNYmDhbpjq9Es9QKS9u3) ]
       │
       ▼ (5. User manual polish & frame naming / selection link)
[ Agent MCP Extraction & Codebase Reconciliation ]
       │
       ▼ (Figma Dev Mode MCP: get_figma_data / Stitch MCP: get_screen)
[ Next.js React Codebase (src/components/...) ]
  - Pure visual/Tailwind/CSS update
  - 100% Supabase queries, real-time hooks, and chit business math preserved
```

---

### B. Screen & Frame Identification Protocol (Zero Ambiguity)
Since Figma and Stitch projects contain multiple screens, test iterations, and scratch frames, the agent must NEVER guess which frame to use. The user points the agent to the approved design via one of two methods:

1. **Method 1: Direct Frame Selection Link (Preferred)**
   - In Figma, select the frame border ➔ Right-click ➔ **Copy/Paste as ➔ Copy link to selection** (Shortcut: `Ctrl + L`).
   - The URL will format as:
     `https://www.figma.com/design/EjxNYmDhbpjq9Es9QKS9u3/Chitfund-Manager?node-id=X-Y`
   - The agent parses `node-id` (converting `X-Y` to `X:Y`) and queries `figma-dev-mode-mcp-server` tool `get_figma_data` with:
     ```json
     { "fileKey": "EjxNYmDhbpjq9Es9QKS9u3", "nodeId": "X:Y" }
     ```

2. **Method 2: Explicit Frame Naming**
   - In Figma, double-click the frame title and rename it (e.g. `Dashboard - Final`, `Members - V2 Approved`).
   - The user informs the agent of the exact name. The agent scans the document tree via Figma MCP and extracts the matching node.

3. **Method 3: Direct Stitch Screen Inspection (Alternative)**
   - If the user approves a design directly in Stitch without re-exporting to Figma, the agent calls `stitch` MCP tool `list_screens` on project `16235470526146286805` to retrieve the latest screen ID, then calls `get_screen` to inspect the raw `htmlCode` and `designSystem`.

---

### C. Stitch AI Prompting & Aesthetics Standard
When generating screens in Google Stitch, follow these prompt guidelines to produce production-grade fintech interfaces:
- **Design Archetype**: Institutional Fintech Dark Mode (inspired by Linear, Stripe, and Mercury).
- **Surface Palette**: Deep zinc/slate dark surfaces (`#09090b`, `#121217`, `#18181b`) with ultra-subtle border contrasts (`border-white/5` to `border-white/10`). Avoid flat pitch black or washed-out grays.
- **Accent Tokens**:
  - Primary Action / Growth: Refined Emerald (`#10b981` / `#059669` / emerald-400 with 10-20% opacity glow).
  - Warnings / Pending: Amber / Warm Gold (`#f59e0b` / `#d97706`).
  - Urgent / Deficit: Crimson / Rose (`#f43f5e`).
- **Typography**: Clean sans-serif hierarchy (Inter or system sans), tabular numbers (`font-mono` / `tabular-nums`) for currency values and dates.
- **Card Styling**: Flat modular cards with subtle inner highlights (`ring-1 ring-white/5`), rounded corners (`rounded-xl` or `rounded-2xl`), generous internal breathing room (`p-5` to `p-6`).

#### Recommended Prompt Template for Stitch:
> "Redesign this chit fund management screen into an institutional-grade dark-mode fintech dashboard. Follow the visual precision of Stripe and Linear. Use deep slate cards with 1px subtle borders, crisp tabular typography for rupee amounts, clean pill badges for statuses, and streamlined action buttons. Retain all existing data fields, stats cards, tables, and quick actions, but elevate the hierarchy and eliminate visual clutter."

---

### D. Codebase Reconciliation & Invariants (Agent Directive)
When applying visual updates from Figma AST or Stitch HTML to React TSX files:
1. **Never Require Manual Explanations**: Extract the visual diff directly from the raw MCP metadata (bounding boxes, layout mode, gap, padding, colors, typography).
2. **Strict Logic Preservation**:
   - DO NOT alter React component state variables, `useState`, `useEffect`, or custom hooks (`useAuth`, `useWallet`).
   - DO NOT alter Supabase queries, real-time subscriptions, or RPC calls.
   - DO NOT alter Chit Fund calculation math (Organizer profit, Laaba Seetu accumulation, winner net payout formulas).
   - DO NOT alter event handler bindings (`onClick`, WhatsApp reminder links, modal toggles).
3. **Component Modularity**: Match styling updates to the corresponding component file (e.g. `DashboardContent.tsx`, `Sidebar.tsx`, `PaymentChecklistPrintModal.tsx`).
4. **Verification**: Always run `npm run build` immediately after applying edits to ensure **0 TypeScript errors**.


