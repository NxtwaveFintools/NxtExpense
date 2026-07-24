/**
 * Test accounts provisioned via scripts/dev/provision-test-accounts.mjs
 * These match real employee records in the database.
 */

const TEST_PASSWORD = 'Password@123'

type TestAccount = {
  email: string
  label: string
  designation: string
  state?: string
}

// Group 1: Standard flow submitters (L1 approver -> Mansoor -> Finance)

export const SRO_AP: TestAccount = {
  email: 'yohan.mutluri@nxtwave.co.in',
  label: 'SRO AP - Yohan Mutluri',
  designation: 'Student Relationship Officer',
  state: 'Andhra Pradesh',
}

export const SRO_KERALA: TestAccount = {
  email: 'akshay.e@nxtwave.co.in',
  label: 'SRO Kerala - Akshay E',
  designation: 'Student Relationship Officer',
  state: 'Kerala',
}

export const BOA_KARNATAKA: TestAccount = {
  email: 'bhargavraj.gv@nxtwave.co.in',
  label: 'BOA Karnataka - Bhargav Raj Gv',
  designation: 'Business Operation Associate',
  state: 'Karnataka',
}

// Real TN ABH under the new hierarchy. Previously this pointed at Hari Haran,
// who is an SBH (not an ABH) and covered both TN and Kerala; the 2026-07
// hierarchy change split that role (TN -> Sreejish, KL -> Jijo) and inactivated
// Hari. Siranjeeva is a genuine ABH whose L1 approver is the TN SBH (Sreejish),
// so this fixture finally means what its name says: a standard-flow TN ABH.
export const ABH_TAMIL_NADU: TestAccount = {
  email: 'siranjeeva.c@nxtwave.co.in',
  label: 'ABH Tamil Nadu - Siranjeeva C',
  designation: 'Area Business Head',
  state: 'Tamil Nadu',
}

// Group 2: Direct flow submitters (Mansoor -> Finance)

export const SBH_AP: TestAccount = {
  email: 'nagaraju.madugula@nxtwave.co.in',
  label: 'SBH AP - Madugula Nagaraju',
  designation: 'State Business Head',
  state: 'Andhra Pradesh',
}

export const SBH_KARNATAKA: TestAccount = {
  email: 'vignesh.shenoy@nxtwave.co.in',
  label: 'SBH Karnataka - Vignesh Shenoy',
  designation: 'State Business Head',
  state: 'Karnataka',
}

export const ZBH_MULTI_STATE: TestAccount = {
  email: 'satyapriya.dash@nxtwave.co.in',
  label: 'ZBH Multi-State - Satya Priya Dash',
  designation: 'Zonal Business Head',
  state: 'Delhi NCR, West Bengal, Odisha, Rajasthan, Uttar Pradesh',
}

export const PM_MANSOOR: TestAccount = {
  email: 'mansoor@nxtwave.co.in',
  label: 'PM - Mansoor Valli Gangupalli',
  designation: 'Program Manager',
  state: 'All States',
}

// Shared approver / direct-flow accounts.
//
// The 2026-07 hierarchy change split the old single "TN + Kerala" SBH (Hari
// Haran, now INACTIVE) into two people, so there is no longer one fixture that
// covers both states. Use the state-specific SBH:
//   - a Kerala submitter's L1 approver  -> SBH_KERALA (Jijo)
//   - a Tamil Nadu SBH direct/approver  -> SBH_TAMIL_NADU (Sreejish)

export const SBH_TAMIL_NADU: TestAccount = {
  email: 'sreejish.mohanakumar@nxtwave.co.in',
  label: 'SBH Tamil Nadu - Sreejish Mohana Kumar',
  designation: 'State Business Head',
  state: 'Tamil Nadu',
}

// Rajasthan chain, post-2026-07. Adarsh was demoted SBH -> ABH and now submits
// through Arka (the new RJ SBH, moved in from Maharashtra). This is the §9.1
// regression case: an ex-SBH turned ABH whose flow became [1,2,3] and who would
// be blocked at submit if his L1 approver were unset. His L1 is Arka.
export const ABH_RAJASTHAN: TestAccount = {
  email: 'adarshanand.digal@nxtwave.co.in',
  label: 'ABH Rajasthan - Adarsh Anand Digal (ex-SBH)',
  designation: 'Area Business Head',
  state: 'Rajasthan',
}

export const SBH_RAJASTHAN: TestAccount = {
  email: 'arkaprabha.ghosh@nxtwave.co.in',
  label: 'SBH Rajasthan - Arka Prabha Ghosh',
  designation: 'State Business Head',
  state: 'Rajasthan',
}

export const SBH_KERALA: TestAccount = {
  email: 'jijo.varghese@nxtwave.co.in',
  label: 'SBH Kerala - Jijo Varghese',
  designation: 'State Business Head',
  state: 'Kerala',
}

// ── Full-regression per-state chains (added 2026-07-24) ─────────────────────
// One representative SRO submitter per active state whose SBH chain was not
// already covered above, so EVERY state's submitter -> SBH -> Mansoor -> Finance
// path is exercised and we can prove no state regressed. States covered above:
// AP, KL, KA, TN, RJ. These add: MH, TG, DL, UP, OD, WB. Verified against the
// live DB on 2026-07-24 — each submitter's L1 is the listed SBH, L3 is Mansoor.

export const SBH_MAHARASHTRA: TestAccount = {
  email: 'ashish.prakashpatil@nxtwave.co.in',
  label: 'SBH Maharashtra - Ashish Prakash Patil',
  designation: 'State Business Head',
  state: 'Maharashtra',
}
export const SRO_MAHARASHTRA: TestAccount = {
  email: 'indraneel.sanjayingole@nxtwave.co.in',
  label: 'SRO Maharashtra - Indraneel Ingole',
  designation: 'Student Relationship Officer',
  state: 'Maharashtra',
}

export const SBH_TELANGANA: TestAccount = {
  email: 'ravinder.jangili@nxtwave.co.in',
  label: 'SBH Telangana - Ravinder Jangili',
  designation: 'State Business Head',
  state: 'Telangana',
}
export const SRO_TELANGANA: TestAccount = {
  email: 'veerabhadraswamy.attili@nxtwave.co.in',
  label: 'SRO Telangana - Attili Veera Bhadra Swamy',
  designation: 'Student Relationship Officer',
  state: 'Telangana',
}

export const SBH_DELHI: TestAccount = {
  email: 'bipin.sati@nxtwave.co.in',
  label: 'SBH Delhi NCR - Bipin Chandra Sati',
  designation: 'State Business Head',
  state: 'Delhi NCR',
}
export const SRO_DELHI: TestAccount = {
  email: 'abhay.kumar@nxtwave.co.in',
  label: 'SRO Delhi NCR - Abhay Kumar',
  designation: 'Student Relationship Officer',
  state: 'Delhi NCR',
}

export const SBH_UTTAR_PRADESH: TestAccount = {
  email: 'akshaykumar.pal@nxtwave.co.in',
  label: 'SBH Uttar Pradesh - Akshay Kumar Pal',
  designation: 'State Business Head',
  state: 'Uttar Pradesh',
}
export const SRO_UTTAR_PRADESH: TestAccount = {
  email: 'ashish.patel@nxtwave.co.in',
  label: 'SRO Uttar Pradesh - Ashish Patel',
  designation: 'Student Relationship Officer',
  state: 'Uttar Pradesh',
}

// Sambit is the SBH for both Odisha and West Bengal; both submitters route to him.
export const SBH_ODISHA_WB: TestAccount = {
  email: 'sambitkumar.aich@nxtwave.co.in',
  label: 'SBH Odisha/West Bengal - Sambit Kumar Aich',
  designation: 'State Business Head',
  state: 'Odisha, West Bengal',
}
export const SRO_ODISHA: TestAccount = {
  email: 'badalranjan.rout@nxtwave.co.in',
  label: 'SRO Odisha - Badal Ranjan Rout',
  designation: 'Student Relationship Officer',
  state: 'Odisha',
}
export const SRO_WEST_BENGAL: TestAccount = {
  email: 'kushal.mukherjee@nxtwave.co.in',
  label: 'SRO West Bengal - Kushal Mukherjee',
  designation: 'Student Relationship Officer',
  state: 'West Bengal',
}

// ── Hierarchy-specific regression personas (added 2026-07-24) ───────────────

// INACTIVE after the change — must NOT be able to access the app.
export const HARI_INACTIVE: TestAccount = {
  email: 'hari.haran@nxtwave.co.in',
  label: 'INACTIVE ex-SBH - Hari Haran S',
  designation: 'State Business Head',
  state: 'Tamil Nadu, Kerala',
}

// Intern -> Employee ID conversion (NW1006377 -> NW0007045). New claims carry
// the new prefix. Kerala SRO, routes to Jijo.
export const SRO_KERALA_HIJAS: TestAccount = {
  email: 'muhammed.hijas@nxtwave.co.in',
  label: 'SRO Kerala - Muhammed Hijas (ID converted)',
  designation: 'Student Relationship Officer',
  state: 'Kerala',
}

// Central-team BOA with approval_start_level = 2: skips the SBH stage and routes
// straight to the HOD (Mansoor). The only such record in the DB.
export const CENTRAL_BOA_CHANDRAMOULI: TestAccount = {
  email: 'chandramouli.narina@nxtwave.co.in',
  label: 'Central BOA - Narina Chandramouli (direct to HOD)',
  designation: 'Business Operation Associate',
  state: 'Central',
}

// New RJ ABH. The migration bug we fixed captured him into the MH SBH's reports;
// he must route to Arka (RJ), never Ashish (MH).
export const ABH_RAJASTHAN_SPARSH: TestAccount = {
  email: 'sparsh.gupta@nxtwave.co.in',
  label: 'ABH Rajasthan - Sparsh Gupta',
  designation: 'Area Business Head',
  state: 'Rajasthan',
}

// Second KA SBH with NO reports yet — has no approver assignments, so must be
// redirected away from /approvals just like a submitter.
export const SBH_KARNATAKA_NITHIN: TestAccount = {
  email: 'nithin.k@nxtwave.co.in',
  label: 'SBH Karnataka (no reports) - Nithin K',
  designation: 'State Business Head',
  state: 'Karnataka',
}

// Finance team

export const FINANCE_1: TestAccount = {
  email: 'finance1@nxtwave.co.in',
  label: 'Finance User 1',
  designation: 'Finance',
}

export const FINANCE_2: TestAccount = {
  email: 'chennakesava.konda@nxtwave.co.in',
  label: 'Finance User 2 - Chennakesava K',
  designation: 'Finance',
}

const PASSWORD_OVERRIDES: Record<string, string> = {
  [PM_MANSOOR.email.toLowerCase()]: 'hod@Nxtwave',
}

export function getTestPassword(email: string): string {
  return PASSWORD_OVERRIDES[email.toLowerCase()] ?? TEST_PASSWORD
}
