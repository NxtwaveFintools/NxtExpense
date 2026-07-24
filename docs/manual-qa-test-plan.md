# NxtExpense — Manual QA Test Plan (Full End-to-End Coverage)

**Purpose:** log in as each role/persona and walk every major flow, so nothing
is missed. Complements the automated e2e suite (which proves routing/logic);
this catches the things automation can't — visual correctness, admin panel
behaviour, error copy, real Microsoft SSO, and the 2026-07 hierarchy change.

**Environment:** test DB `ibrvpangpuxiorspeffz` · app at `http://localhost:3000`
(run `npm run dev`).

**Passwords:** everyone = `Password@123`. **Mansoor = `hod@Nxtwave`.**
Production uses Microsoft SSO — password login is test-only.

**How to read the checkboxes:** `[ ]` = to do, `[x]` = pass, `[!]` = failed/needs a
look. Note the claim number when a step creates one — later steps reuse it.

---

## 0. Accounts you'll use (by role)

| Persona                  | Login                                    | Use for                                 |
| ------------------------ | ---------------------------------------- | --------------------------------------- |
| **Admin**                | (your admin account)                     | admin panel, employee mgmt              |
| **PM / HOD**             | `mansoor@nxtwave.co.in` (`hod@Nxtwave`)  | stage-2 approvals, direct-to-finance    |
| **Finance 1**            | `finance1@nxtwave.co.in`                 | stage-3 finance review, payment release |
| **Finance 2**            | `chennakesava.konda@nxtwave.co.in`       | second finance user                     |
| **ZBH (DL/OD/RJ/UP/WB)** | `satyapriya.dash@nxtwave.co.in`          | zonal read-only visibility, direct flow |
| **ZBH (KA/MH)**          | `harisanthosh.tibirisetty@nxtwave.co.in` | zonal visibility                        |
| **SBH AP**               | `nagaraju.madugula@nxtwave.co.in`        | L1 approver + direct flow               |
| **SBH KA**               | `vignesh.shenoy@nxtwave.co.in`           | L1 approver                             |
| **SBH KA (2nd)**         | `nithin.k@nxtwave.co.in`                 | new SBH, **no reports yet**             |
| **SBH TN**               | `sreejish.mohanakumar@nxtwave.co.in`     | reactivated TN SBH                      |
| **SBH KL**               | `jijo.varghese@nxtwave.co.in`            | new KL SBH                              |
| **SBH MH**               | `ashish.prakashpatil@nxtwave.co.in`      | new MH SBH                              |
| **SBH DL**               | `bipin.sati@nxtwave.co.in`               | new DL SBH                              |
| **SBH RJ**               | `arkaprabha.ghosh@nxtwave.co.in`         | moved MH→RJ                             |
| **SBH UP**               | `akshaykumar.pal@nxtwave.co.in`          | narrowed DL→UP                          |
| **SBH TG**               | `ravinder.jangili@nxtwave.co.in`         | untouched state                         |
| **SBH OD/WB**            | `sambitkumar.aich@nxtwave.co.in`         | covers two states                       |
| **ABH TN**               | `siranjeeva.c@nxtwave.co.in`             | new joiner, submits via Sreejish        |
| **ABH RJ (ex-SBH)**      | `adarshanand.digal@nxtwave.co.in`        | **demoted SBH→ABH**                     |
| **SRO AP**               | `yohan.mutluri@nxtwave.co.in`            | standard submitter                      |
| **SRO KL**               | `akshay.e@nxtwave.co.in`                 | submits via Jijo                        |
| **SRO MH**               | `indraneel.sanjayingole@nxtwave.co.in`   | submits via Ashish                      |
| **SRO TG**               | `veerabhadraswamy.attili@nxtwave.co.in`  | submits via Ravinder                    |
| **SRO DL**               | `abhay.kumar@nxtwave.co.in`              | submits via Bipin                       |
| **SRO UP**               | `ashish.patel@nxtwave.co.in`             | submits via Akshay                      |
| **SRO OD**               | `badalranjan.rout@nxtwave.co.in`         | submits via Sambit                      |
| **SRO WB**               | `kushal.mukherjee@nxtwave.co.in`         | submits via Sambit                      |
| **BOA KA**               | `bhargavraj.gv@nxtwave.co.in`            | BOA submitter                           |

> Approval-stage vocabulary: **Stage 1** = SBH (`L1_PENDING`) · **Stage 2** = HOD/Mansoor
> (`L2_PENDING`) · **Stage 3** = Finance (`L3_PENDING_FINANCE_REVIEW`) → `APPROVED` →
> `PAYMENT_RELEASED`. Rejections can happen at any stage.

---

## 1. Quick smoke (~10 min) — do this first

- [ ] `/login` renders (logged out); Microsoft SSO button visible
- [ ] Log in as **SRO AP** → lands on `/dashboard`, sees **My Claims** tile, **no** Finance/Approvals
- [ ] Log in as **SBH AP** → sees **My Claims** + **Pending Approvals**
- [ ] Log in as **Mansoor** → sees My Claims + Approvals, **no** Finance
- [ ] Log in as **Finance 1** → sees **Finance** + **Approved History**, **no** My Claims
- [ ] Log in as **Admin** → sees **Admin** nav
- [ ] Submit one claim as SRO AP → approve as SBH AP → approve as Mansoor → finance-approve + release as Finance 1 → status `PAYMENT_RELEASED`

If all pass, the plumbing is healthy. Continue to the full matrix below.

---

## 2. Access control / authorization (per role)

Log in as each and confirm the sidebar + direct-URL access. Try typing the URL
directly to confirm redirects, not just hidden nav.

### 2.1 SRO / BOA / ABH (submitters)

- [ ] Sees: Dashboard, My Claims, Profile
- [ ] Does **not** see: Approvals, Finance, Admin
- [ ] `/approvals` → redirected away (no approver assignments)
- [ ] `/finance` → redirected away
- [ ] `/approved-history` → redirected away
- [ ] `/admin` → redirected away

### 2.2 SBH (approver + submitter)

- [ ] Sees: Dashboard, My Claims, **Pending Approvals**, Profile
- [ ] `/approvals` accessible; `/finance` and `/admin` → redirected away
- [ ] Claim form shows **Two Wheeler and Four Wheeler** vehicle options

### 2.3 ZBH

- [ ] Can log in; sees Approvals (read-only visibility of claims beneath their zone)
- [ ] `/finance`, `/admin` → redirected away

### 2.4 PM / Mansoor

- [ ] Sees: Dashboard, My Claims, Approvals; **no** Finance
- [ ] `/finance` → redirected away

### 2.5 Finance

- [ ] Sees: **Finance**, **Approved History**; **no** My Claims, **no** Approvals
- [ ] `/claims` and `/claims/new` → redirected away (finance can't submit)
- [ ] `/finance` accessible

### 2.6 Admin

- [ ] Sees Admin nav with all sub-sections (below)
- [ ] Unauthenticated: any protected route → `/login`

---

## 3. Claim submission (submitter personas)

Do the **base-location** and **outstation** variants at least once each. Use SRO AP
for the happy path, then repeat outstation as any SRO.

### 3.1 Base-location claim

- [ ] `/claims/new` loads; date + work-location selectors visible
- [ ] Future date is **rejected** (client-side error)
- [ ] Select a base work location → intra-city fields behave correctly
- [ ] Two-wheeler KM **> 200 is rejected** (SRO 2W limit)
- [ ] Submit → success toast with claim number → appears in My Claims as `L1_PENDING`

### 3.2 Outstation claim

- [ ] Choose outstation work location → **outstation state + city** required
- [ ] Inter-city travel decision enforced; **same From and To city rejected** for own-vehicle inter-city
- [ ] Intra-city decision enforced
- [ ] Rented vs Own vehicle → claim detail shows correct **Fuel Allowance** text
- [ ] Submit → `L1_PENDING`

### 3.3 Vehicle / designation rules

- [ ] **SRO** sees only **Two Wheeler**
- [ ] **SBH** sees **Two Wheeler and Four Wheeler**
- [ ] Food and accommodation amounts match the designation rate (see §7)

### 3.4 Duplicate / same-date

- [ ] Submitting a **second active claim for the same date** is blocked with a friendly error

---

## 4. Approval flows (the core matrix)

For **each state**, submit as the submitter, then approve down the chain. This is
the all-round regression — confirm every SBH's queue actually receives the claim.

| State | Submit as           | Approve stage 1 as (SBH) | Stage 2 (HOD) | Stage 3 (Finance) |
| ----- | ------------------- | ------------------------ | ------------- | ----------------- |
| AP    | SRO AP              | SBH AP (Nagaraju)        | Mansoor       | Finance 1         |
| KL    | SRO KL              | **Jijo**                 | Mansoor       | Finance 1         |
| KA    | BOA KA              | Vignesh                  | Mansoor       | Finance 1         |
| TN    | ABH TN (Siranjeeva) | **Sreejish**             | Mansoor       | Finance 1         |
| RJ    | ABH RJ (Adarsh)     | **Arka**                 | Mansoor       | Finance 1         |
| MH    | SRO MH              | **Ashish**               | Mansoor       | Finance 1         |
| TG    | SRO TG              | Ravinder                 | Mansoor       | Finance 1         |
| DL    | SRO DL              | **Bipin**                | Mansoor       | Finance 1         |
| UP    | SRO UP              | Akshay                   | Mansoor       | Finance 1         |
| OD    | SRO OD              | Sambit                   | Mansoor       | Finance 1         |
| WB    | SRO WB              | Sambit                   | Mansoor       | Finance 1         |

For each row:

- [ ] Claim appears in the **SBH's Pending Approvals** queue (and nobody else's)
- [ ] SBH **Approve** → moves to `L2_PENDING`, now in **Mansoor's** queue
- [ ] Mansoor **Approve** → moves to `L3_PENDING_FINANCE_REVIEW`, in **Finance** queue
- [ ] Finance **Approve** → `APPROVED`; then **Release payment** → `PAYMENT_RELEASED` (terminal)
- [ ] The submitter sees the status update at each step in My Claims

### 4.1 Direct flows (SBH / ZBH / PM submit their own)

- [ ] **SBH** (e.g. Sreejish) submits own claim → **skips stage 1**, starts at `L2_PENDING` (Mansoor)
- [ ] **ZBH** (Satya) submits → direct to Mansoor
- [ ] **PM** (Mansoor) submits → goes **straight to Finance** (`L3_PENDING_FINANCE_REVIEW`)
- [ ] An SBH cannot approve their **own** submitted claim

### 4.2 Self-approval / wrong-approver guards

- [ ] A claim in another SBH's queue does **not** appear in an unrelated SBH's queue
- [ ] Nithin (SBH KA, **no reports**) has an **empty** Pending Approvals queue and no errors

---

## 5. Rejection & reclaim flows

### 5.1 Stage-1 (SBH) rejection

- [ ] SRO submits → SBH **Rejects** (notes required) → claim shows **permanently closed** banner
- [ ] Rejecting **without** notes is blocked

### 5.2 Stage-2 (Mansoor) rejection

- [ ] Submit → SBH approve → Mansoor **Rejects** → permanently closed

### 5.3 Finance rejection — no reclaim

- [ ] Reach finance → Finance **Rejects without** allow-reclaim → permanently closed
- [ ] Submitter **cannot** raise a new same-date claim

### 5.4 Finance rejection — with reclaim

- [ ] Finance **Rejects with** allow-reclaim → banner shows **new-claim-permitted**
- [ ] Submitter **can** raise a new claim for that date (supersedes the old one)
- [ ] The old claim shows as **superseded**
- [ ] Attempting a **third** same-date submit is blocked with a friendly error

---

## 6. Finance-specific

Log in as **Finance 1** / **Finance 2**:

- [ ] Finance **Queue** lists all `L3_PENDING_FINANCE_REVIEW` claims
- [ ] **Approve** → `APPROVED`; **Release payment** → `PAYMENT_RELEASED`
- [ ] **Approved History** lists approved/paid claims
- [ ] **Payment Journals** CSV export downloads and opens correctly
- [ ] Approved-history / finance exports (CSV) download without error
- [ ] Two finance users see the same shared queue (pick-up by either)

---

## 7. State & designation-specific rules

### 7.1 Expense rates by designation

- [ ] **SBH** accommodation = **₹2000/night**; **ABH** accommodation = **₹1000/night**
- [ ] `FOOD_WITH_PRINCIPALS` = ₹500 for both
- [ ] **Adarsh** (now ABH) — a **new** claim uses the **₹1000** ABH rate; his old SBH-era claims keep **₹2000** (frozen snapshot)

### 7.2 State food overrides

- [ ] Outstation food for **AP / TG** submitters reflects the state override (compare against a non-override state)
- [ ] Food value is correct across the approval chain (snapshot doesn't drift)

### 7.3 Outstation cities

- [ ] Each state's submitter sees their state's outstation city list on the claim form

---

## 8. Hierarchy change (2026-07) — targeted checks

These are the specific behaviours the change introduced. **Highest priority.**

### 8.1 New SBHs can operate

- [ ] Jijo, Sreejish, Ashish, Bipin, Arka each: log in, see **Pending Approvals**, approve a real claim
- [ ] Nithin: logs in, submits his own claim (direct flow), has **no** approval queue

### 8.2 Adarsh (demoted SBH → ABH) — the key regression

- [ ] Adarsh logs in and **can submit a claim** (not blocked)
- [ ] His claim routes to **Arka** at stage 1 (not to himself, not blocked)
- [ ] Adarsh **no longer** has a Pending Approvals tab (no reports point at him)
- [ ] Adarsh no longer appears as an L1 approver option in the admin dropdown for RJ

### 8.3 Hari Haran (inactivated)

- [ ] Hari **cannot log in** (INACTIVE → `/no-access` or blocked)
- [ ] Hari's **past approvals** remain visible to Finance/Admin (audit trail intact)
- [ ] No claim is stuck pointing at Hari

### 8.4 The splits routed correctly

- [ ] Kerala SROs (e.g. Akshay E, Muhammed Hijas) now route to **Jijo**, not Hari
- [ ] Tamil Nadu ABHs (Siranjeeva, Rethina) route to **Sreejish**
- [ ] Maharashtra team routes to **Ashish**; **Sparsh Gupta** (RJ ABH) routes to **Arka**, not Ashish
- [ ] Delhi NCR routes to **Bipin**; **Uttar Pradesh** still routes to **Akshay** (not Bipin)

### 8.5 Muhammed Hijas ID conversion

- [ ] Hijas can log in; **new** claims use `CLAIM-NW0007045-…`; **old** claims keep the old prefix

### 8.6 Central-team direct-to-HOD (Chandramouli)

- [ ] Chandramouli (BOA, central) submits → routes **directly to Mansoor** (skips SBH), not stuck

---

## 9. Admin panel

Log in as **Admin**, visit each section:

- [ ] **Employees** — search, view; reassign approvers; replace flow (don't finalize on prod)
- [ ] **Approver Rules** — per-state rules render
- [ ] **State / City** — create state, toggle active, create city, bulk import (confirmation dialogs appear)
- [ ] **Expense Rates** — rates per designation/state render and edit
- [ ] **Designations** — list renders
- [ ] **Vehicle Types** — list renders
- [ ] **Work Locations** — list renders
- [ ] **Claims** — admin claim view/search
- [ ] **Analytics** — dashboards load, filter by state
- [ ] **Logs** — admin action log renders
- [ ] The new joiners all appear with correct designation/state/approvers
- [ ] Approver dropdowns for a state list the **current** SBH (post-change)

---

## 10. Edge cases & negative tests

- [ ] Future-dated claim rejected (client-side)
- [ ] 2W KM > 200 rejected
- [ ] Empty claims list shows a friendly empty state
- [ ] Finance user cannot reach `/claims/new`
- [ ] Non-existent route → login or 404 (no crash)
- [ ] Session: log out clears access; protected routes bounce to `/login`
- [ ] Reject-without-notes blocked at every stage
- [ ] Third same-date submit after reclaim blocked

---

## 11. Cross-cutting

- [ ] **Profile** page renders correct name/designation/state for several roles
- [ ] **Approval history visibility**: an SBH sees claims they **acted on**, but not their **own submitted** claims in the approvals view
- [ ] A new SBH **inherits visibility** of their predecessor's acted claims only where intended (clean cut for Hari's split — Jijo/Sreejish should **not** see Hari's past approvals)
- [ ] Claim detail line items show correct amounts and labels
- [ ] `/approvals` stays responsive with a large queue (Nagaraju, Satya, Mansoor)

---

## 12. Sign-off

- [ ] All of §1 smoke pass
- [ ] All 11 state chains in §4 pass
- [ ] All §8 hierarchy-change checks pass ← **the reason this round exists**
- [ ] No P1/P2 defects open

**Tester:** ******\_\_\_\_****** **Date:** ****\_\_\_\_**** **Build/commit:** ****\_\_\_\_****

```

```
