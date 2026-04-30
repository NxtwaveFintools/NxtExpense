/**
 * Test accounts provisioned via scripts/dev/provision-test-accounts.mjs
 * These match real employee records in the database.
 */

export const TEST_PASSWORD = 'Password@123'

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

// Shared approver/direct-flow accounts

export const SBH_TN_KERALA: TestAccount = {
  email: 'hari.haran@nxtwave.co.in',
  label: 'SBH TN/Kerala - Hari Haran S',
  designation: 'State Business Head',
  state: 'Tamil Nadu, Kerala',
}

// Finance team

export const FINANCE_1: TestAccount = {
  email: 'finance1@nxtwave.co.in',
  label: 'Finance User 1',
  designation: 'Finance',
}

export const FINANCE_2: TestAccount = {
  email: 'finance2@nxtwave.co.in',
  label: 'Finance User 2',
  designation: 'Finance',
}
