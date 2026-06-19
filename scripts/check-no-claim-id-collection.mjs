#!/usr/bin/env node
// Finance read-architecture guard (Phase 5b).
//
// Fails the build if the forbidden application-side claim-ID collection pattern
// reappears in any Finance read path. The permanent invariant: no Finance read
// path may materialize claim-ID collections whose size grows with claim count.
// (filters -> collect ids -> arrays -> chunk -> merge -> re-query). Any future
// claim filtering must compose through finance_filtered_claim_ids() or a
// resolver-backed RPC.
//
// See: src/features/finance/data/README.md
//
// Implemented in Node (not bash/rg) so it runs identically on Windows + CI.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'

// Directories where the invariant is enforced (the Finance read paths).
const SCAN_DIRS = [
  'src/features/finance',
  'src/features/approvals',
  'src/app/(app)/approved-history',
]

// Identifiers that constitute the collection anti-pattern. Deliberately specific
// to claim-ID collection so legitimate bounded streaming (e.g. CSV export
// `chunk` / `Transfer-Encoding: chunked`) is NOT flagged.
const FORBIDDEN = [
  'SAFE_IN_BATCH_SIZE',
  'MAX_FILTERED_CLAIM_IDS',
  'MAX_SCOPED_ACTION_CLAIMS',
  'ACTION_FILTER_BATCH_SIZE',
  'intersectClaimIds',
  'getFilteredClaimIdsForFinance',
  'getActionFilteredClaimIds',
  'collect[A-Za-z]*ClaimIds',
  'collect[A-Za-z]*Ids',
]
const PATTERN = new RegExp(FORBIDDEN.join('|'))

const CODE_EXT = /\.(ts|tsx|js|jsx|mjs)$/

function walk(dir) {
  let files = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return files // a scan dir may not exist in every checkout; skip silently.
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      files = files.concat(walk(full))
    } else if (CODE_EXT.test(entry)) {
      files.push(full)
    }
  }
  return files
}

const violations = []
for (const dir of SCAN_DIRS) {
  for (const file of walk(dir)) {
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (PATTERN.test(line)) {
        violations.push(`${file.split(sep).join('/')}:${i + 1}: ${line.trim()}`)
      }
    })
  }
}

if (violations.length > 0) {
  console.error('Forbidden claim-ID collection pattern detected in Finance read paths:\n')
  for (const v of violations) console.error(`  ${v}`)
  console.error(
    '\nFinance read paths must not materialize claim-ID collections whose size grows\n' +
      'with claim count. Compose filtering through finance_filtered_claim_ids() or a\n' +
      'resolver-backed RPC instead. See src/features/finance/data/README.md.'
  )
  process.exit(1)
}

console.log('OK: no claim-ID collection pattern in Finance read paths.')
