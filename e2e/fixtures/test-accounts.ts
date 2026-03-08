/**
 * Test accounts provisioned via scripts/dev/provision-test-accounts.mjs
 * These match real employee records in the database.
 */

export const TEST_PASSWORD = 'Password@123'

// ── SRO / BOA / ABH (L1 → SBH, L3 → Mansoor) ────────────────────────────

export const SRO_AP = {
  email: 'yohan.mutluri@nxtwave.co.in',
  label: 'SRO AP — Yohan Mutluri',
  designation: 'Student Relationship Officer',
  state: 'Andhra Pradesh',
}

export const SRO_KERALA = {
  email: 'akshay.e@nxtwave.co.in',
  label: 'SRO Kerala — Akshay E',
  designation: 'Student Relationship Officer',
  state: 'Kerala',
}

export const BOA_KARNATAKA = {
  email: 'bhargavraj.gv@nxtwave.co.in',
  label: 'BOA Karnataka — Bhargav Raj Gv',
  designation: 'Business Operation Associate',
  state: 'Karnataka',
}

export const ABH_TN = {
  email: 'hari.haran@nxtwave.co.in',
  label: 'ABH Tamil Nadu — Hari Haran S',
  designation: 'Area Business Head',
  state: 'Tamil Nadu',
}

// ── SBH / ZBH / PM (L3 → Mansoor directly) ────────────────────────────────

export const SBH_AP = {
  email: 'nagaraju.madugula@nxtwave.co.in',
  label: 'SBH AP — Madugula Nagaraju',
  designation: 'State Business Head',
  state: 'Andhra Pradesh',
}

export const SBH_KARNATAKA = {
  email: 'vignesh.shenoy@nxtwave.co.in',
  label: 'SBH Karnataka — Vignesh Shenoy',
  designation: 'State Business Head',
  state: 'Karnataka',
}

export const ZBH_MULTI = {
  email: 'satyapriya.dash@nxtwave.co.in',
  label: 'ZBH Multi — Satya Priya Dash',
  designation: 'Zonal Business Head',
}

export const PM_MANSOOR = {
  email: 'mansoor@nxtwave.co.in',
  label: 'PM — Mansoor Valli Gangupalli',
  designation: 'Program Manager',
}

// ── Approvers ──────────────────────────────────────────────────────────────

export const SBH_TN_KERALA = {
  email: 'sreejish.mohanakumar@nxtwave.co.in',
  label: 'SBH TN+Kerala — L1 approver for Akshay/Hari',
  designation: 'State Business Head',
}

// ── Finance Team ───────────────────────────────────────────────────────────

export const FINANCE_1 = {
  email: 'finance1@nxtwave.co.in',
  label: 'Finance User 1',
  designation: 'Finance',
}

export const FINANCE_2 = {
  email: 'finance2@nxtwave.co.in',
  label: 'Finance User 2',
  designation: 'Finance',
}
