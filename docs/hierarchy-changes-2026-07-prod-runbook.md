# Hierarchy Changes 2026-07 — Production Runbook

**Companion to:** `docs/hierarchy-changes-2026-07-findings.md` (discovery & decisions)
**Migrations:** `supabase/migrations/20260723*` (8 files) · rollbacks in `supabase/rollback/`
**Status:** applied successfully to test (`ibrvpangpuxiorspeffz`). Not yet applied to production.

---

## 0. Before anything: finish the test database

Test ran the **original** Maharashtra migration, which swept by pointer alone and
captured Sparsh Gupta (Rajasthan ABH) into the Maharashtra SBH's reports.
`20260723110000` has since been corrected to filter on MH primary state, but an
already-applied migration does not re-run. `20260723130000` repairs it.

```bash
supabase db push          # applies 20260723130000 only
```

Expected: `NOTICE: Corrected Sparsh Gupta: level-1 approver Ashish Prakash Patil -> Arka Prabha Ghosh.`

**Production will never see this defect** — it gets the corrected `20260723110000`,
so `20260723130000` is a deliberate no-op there (`NOTICE: ... already reports to
Arka Prabha Ghosh; no change needed.`). That is success, not a skipped step.

---

## 1. Point the CLI at production — and prove it

The single most dangerous step. `supabase db push` acts on whatever is linked,
and the link is invisible in the command.

```bash
cat supabase/.temp/project-ref     # must read: rourehizhyshgvbzcscc
supabase link --project-ref rourehizhyshgvbzcscc
cat supabase/.temp/project-ref     # verify again after linking
```

- [ ] `project-ref` reads `rourehizhyshgvbzcscc` **immediately before** the push

---

## 2. Pre-flight verification (read-only, no writes)

Every head-count in the findings doc is a **dev** number. The migrations are
count-agnostic — they move whatever matches — but you need the expected numbers
to tell success from partial success.

### 2a. The people must exist, with the right status and role

```sql
select e.employee_id, e.employee_name, lower(e.employee_email) as email,
       d.designation_code, st.status_code,
       (select string_agg(s.state_code || case when es.is_primary then '*' else '' end, ',')
          from employee_states es join states s on s.id = es.state_id
         where es.employee_id = e.id) as states,
       (select string_agg(r.role_code, ',')
          from employee_roles er join roles r on r.id = er.role_id
         where er.employee_id = e.id and er.is_active) as roles
from employees e
join designations d on d.id = e.designation_id
left join employee_statuses st on st.id = e.employee_status_id
where lower(e.employee_email) in (
  'mansoor@nxtwave.co.in','satyapriya.dash@nxtwave.co.in',
  'harisanthosh.tibirisetty@nxtwave.co.in','hari.haran@nxtwave.co.in',
  'arkaprabha.ghosh@nxtwave.co.in','adarshanand.digal@nxtwave.co.in',
  'akshaykumar.pal@nxtwave.co.in','sreejish.mohanakumar@nxtwave.co.in',
  'vignesh.shenoy@nxtwave.co.in','muhammed.hijas@nxtwave.co.in')
order by d.hierarchy_level desc, e.employee_name;
```

- [ ] All 10 present. Missing anchors abort Phase 2 by design, but find out now.
- [ ] **Sreejish is INACTIVE with EMPLOYEE only** — if he is already ACTIVE with
      `APPROVER_L1`, someone has changed prod and the assumptions need re-checking.
- [ ] **Record Muhammed Hijas's current `employee_id`.** You need it for rollback;
      it is unrecoverable from the database once converted (see §6).

### 2b. No ID or email collisions for the 9 new joiners

```sql
select employee_id, employee_name, employee_email from employees
where employee_id in ('NW0007161','NW0007243','NW0007236','NW0007233','NW0007185',
                      'NW0006996','NW0000747','NW0007097','NW0007253','NW0007045')
   or lower(employee_email) in (
     'siranjeeva.c@nxtwave.co.in','c.rethinakumar@nxtwave.co.in',
     'nilesh.tiwari@nxtwave.co.in','prathamesh.pawar@nxtwave.co.in',
     'sparsh.gupta@nxtwave.co.in','ashish.prakashpatil@nxtwave.co.in',
     'bipin.sati@nxtwave.co.in','jijo.varghese@nxtwave.co.in','nithin.k@nxtwave.co.in');
```

- [ ] **Returns zero rows.** An `employee_id` collision is the one case
      `ON CONFLICT (employee_email)` does not absorb — it aborts the migration.

### 2c. Real report counts per outgoing SBH

```sql
select l1.employee_name as sbh, coalesce(s.state_code,'(NO STATE)') as report_state,
       d.designation_code, count(*) as n
from employees e
join employees l1 on l1.id = e.approval_employee_id_level_1
left join employee_states es on es.employee_id = e.id and es.is_primary
left join states s on s.id = es.state_id
join designations d on d.id = e.designation_id
where lower(l1.employee_email) in (
  'hari.haran@nxtwave.co.in','akshaykumar.pal@nxtwave.co.in',
  'adarshanand.digal@nxtwave.co.in','arkaprabha.ghosh@nxtwave.co.in')
group by 1,2,3 order by 1,2,3;
```

- [ ] Write these numbers down. Dev reference: MH 7 · RJ 9 (incl. Adarsh's
      self-loop) · KL 4 · TN 12 · DL 7 · Akshay keeps UP 11.
- [ ] **Any report showing `(NO STATE)` under Arka** will abort the Maharashtra
      migration by design (the filter would silently skip them). Phase 2's
      backfill fixes MH; anyone else needs a decision first.

### 2d. Rollback snapshot — capture BEFORE any write

```sql
select id, employee_id, employee_name, employee_email, designation_id,
       employee_status_id, approval_employee_id_level_1,
       approval_employee_id_level_2, approval_employee_id_level_3, approval_start_level
from employees;

select es.employee_id, es.state_id, es.is_primary from employee_states es;
select er.employee_id, er.role_id, er.is_active from employee_roles er;
```

- [ ] All three saved somewhere outside the database.

---

## 3. Do NOT push all 8 at once

`supabase db push` applies every pending migration. On prod that runs the entire
cutover in one shot and ends with Hari inactivated.

The drain gates make it fail _safely_ — each file is its own transaction, so a
tripped gate aborts that file and leaves earlier ones committed and recorded —
but it is not the state-by-state rollout this was designed for.

**Stage it.** Keep only what you intend to apply in `supabase/migrations/`:

```bash
mkdir -p supabase/_staged
mv supabase/migrations/202607231[123]* supabase/_staged/   # hold Phase 3 + 4 + fix
supabase db push                                            # Phase 2 only
```

Move each file back as its state is ready. `supabase/_staged/` is not read by the
CLI.

---

## 4. Phase 2 — create the people (safe to ship alone)

Inert by construction: new rows have no reports, so no queue moves and no claim
changes hands.

- [ ] `supabase db push` with only `20260723100000` present
- [ ] Notices show the MH backfill count and `Phase 2 complete`
- [ ] Watch for `Muhammed Hijas already holds NW0007045 (or is absent)` — if you
      see this on a first run, he was **not** found by email. Investigate.

Verify:

```sql
select e.employee_name, d.designation_code, st.status_code,
       (select string_agg(s.state_code || case when es.is_primary then '*' else '' end, ',')
          from employee_states es join states s on s.id=es.state_id where es.employee_id=e.id) as states,
       (select string_agg(r.role_code, ',') from employee_roles er join roles r on r.id=er.role_id
         where er.employee_id=e.id and er.is_active) as roles,
       l1.employee_name as level_1
from employees e
join designations d on d.id=e.designation_id
join employee_statuses st on st.id=e.employee_status_id
left join employees l1 on l1.id=e.approval_employee_id_level_1
where lower(e.employee_email) in (
  'ashish.prakashpatil@nxtwave.co.in','bipin.sati@nxtwave.co.in','jijo.varghese@nxtwave.co.in',
  'nithin.k@nxtwave.co.in','siranjeeva.c@nxtwave.co.in','c.rethinakumar@nxtwave.co.in',
  'nilesh.tiwari@nxtwave.co.in','prathamesh.pawar@nxtwave.co.in','sparsh.gupta@nxtwave.co.in',
  'sreejish.mohanakumar@nxtwave.co.in')
order by d.hierarchy_level desc, e.employee_name;
```

- [ ] 10 rows · 4 new SBH + Sreejish all ACTIVE with `APPROVER_L1` · 5 ABH with a
      non-null `level_1` · states as specified
- [ ] **Ask one new joiner to log in.** Microsoft SSO needs only the employees
      row, but this is the cheapest possible proof.

> Sit on Phase 2 for as long as you like. Nothing downstream depends on timing.

---

## 5. Phase 3 — one state at a time, each gated on an empty queue

For **each** state, in this order — Maharashtra **must** precede Rajasthan:

| Order | File             | Moves                     | Gate                     |
| ----- | ---------------- | ------------------------- | ------------------------ |
| 1     | `20260723110000` | Arka → Ashish (MH)        | Arka's L1 queue          |
| 2     | `20260723110100` | Adarsh → Arka (RJ)        | Adarsh's L1 queue        |
| 3     | `20260723110200` | Hari → Jijo (KL only)     | Hari's **KL** L1 queue   |
| 4     | `20260723110300` | Hari → Sreejish (TN only) | Hari's **TN** L1 queue   |
| 5     | `20260723110400` | Akshay → Bipin (DL only)  | Akshay's **DL** L1 queue |

Per state:

1. Tell the outgoing approver to clear their `L1_PENDING` queue.
2. Confirm empty:

```sql
select l1.employee_name as approver, coalesce(s.state_code,'(none)') as state, count(*) as pending
from expense_claims c
join employees owner on owner.id = c.employee_id
join employees l1 on l1.id = owner.approval_employee_id_level_1
join claim_statuses cs on cs.id = c.status_id
left join employee_states es on es.employee_id = owner.id and es.is_primary
left join states s on s.id = es.state_id
where cs.status_code = 'L1_PENDING'
group by 1,2 order by 1,2;
```

3. Move the file back into `supabase/migrations/` and `supabase db push`.
4. Check the notice count against your §2c number.

- [ ] The migration **refuses to run** if the queue is not empty. That is the
      mechanism enforcing "existing claims stay with their original approver" —
      if it throws, the answer is to drain, never to bypass it.
- [ ] After step 4, expect `Hari Haran S now has zero level-1 reports`. If it
      instead says `ATTENTION: ... still has N`, someone's primary state is
      neither KL nor TN — resolve before Phase 4.
- [ ] After step 5, expect `Akshay Kumar Pal retains N Uttar Pradesh report(s)`.
      N must be > 0; the migration aborts otherwise.

---

## 6. Phase 4 — role/status/designation changes (last, irreversible-ish)

- [ ] Hari's approval queue is empty **and** his own claims are settled
      (`L1_PENDING`, `L2_PENDING`, `L3_PENDING_FINANCE_REVIEW`, `APPROVED`).
      The migration checks both and refuses otherwise — once INACTIVE he cannot
      log in to see anything.
- [ ] Apply `20260723120000`, then `20260723130000` (expected no-op).

Verify the whole end state:

```sql
select coalesce(l1.employee_name,'(no L1)') as approver, count(*) as reports,
       string_agg(distinct coalesce(s.state_code,'(none)'), ',') as report_states
from employees e
join employees l1 on l1.id = e.approval_employee_id_level_1
left join employee_states es on es.employee_id=e.id and es.is_primary
left join states s on s.id=es.state_id
join employee_statuses st on st.id=e.employee_status_id
where st.status_code='ACTIVE'
group by 1 order by 2 desc;
```

- [ ] **Every approver's `report_states` is a single state** (except Sambit
      OD/WB, who is unchanged). A second state code is the Sparsh-class bug —
      an SBH holding another state's reports.
- [ ] Hari INACTIVE with 0 reports · Adarsh is ABH with Arka as `level_1`
- [ ] **Adarsh submits a test claim successfully.** This is the real regression
      test: as an ABH his flow becomes `[1,2,3]`, and a null `level_1` would
      block every submission with an error.

---

## 7. Known open item — not blocking, but decide

`e2e/fixtures/test-accounts.ts` and `scripts/dev/provision-test-accounts.mjs`
still name Hari Haran as the TN/Kerala L1 approver. Phase 4 makes him INACTIVE,
so those e2e specs will fail against any database where Phase 4 has run.

The vitest unit suite is unaffected (904 passing — those fixtures are mocked, not
live), so this is an e2e-only concern.

Rewiring them to Sreejish/Jijo needs a password-login `Test_Migrations` entry,
which cuts against the SSO-only decision. Park it or decide it — but do not let
a red e2e run after Phase 4 be a surprise.

---

## 8. If something goes wrong

Rollback scripts in `supabase/rollback/`, applied in **reverse order**. Each one
checks its own precondition and refuses if you skip a step:

```
20260723130000 → 120000 → 110400 → 110300 → 110200 → 110100 → 110000 → 100000
```

- The Phase 2 rollback **deletes** the 9 new people, and refuses if any of them
  hold approver assignments, claims, or approval history.
- ⚠ **Muhammed Hijas's original `employee_id` cannot be derived** once converted.
  The rollback writes `NW1006377` (the dev value). Use the id you recorded in
  §2a, or read it off his existing `claim_number` values, which retain the old
  prefix — and edit the literal before running.
