// src/lib/localImpact.js
// ============================================================
// LOCAL IMPACT COMPUTATION (fallback / guarantee layer)
//
// The ML /train service computes the ATT, matched-pair details
// and the Pre-Post change profile on the uploaded CSV. When the
// auto-combined questionnaire dataset trips over the service's
// assumptions it can come back with `matched_pairs: 0`, empty
// `pair_profiles` and empty `profile_updates`, which leaves the
// Impact tab with blank numbers, no "View matched pair details"
// button and no Pre-Post Change Profile table.
//
// `enrichImpact` fills that gap using the actual responses:
//   - propensity scores come from the service itself
//     (analysisResults.ps_output.ps), so the matching is done on
//     the same PS the service computed;
//   - 1-NN logit-scale caliper matching (the same method the
//     service uses), auto-relaxing the caliper until real pairs
//     are produced;
//   - ATT mean, bootstrap 95% CI and paired t-test p-value are
//     recomputed from the matched outcome differences;
//   - the Pre-Post Change Profile is reproduced client-side;
//     when the dataset has A/B wave-pair columns it uses the
//     same per-group pre->post counts as the service, otherwise
//     it falls back to a treated-vs-control pairwise profile.
//
// The service's own numbers are always preferred when they exist
// (non-zero matched pairs + pair profiles); local values only fill
// the gaps so the Impact tab always has data to show.
// ============================================================

export const toNumLoose = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const cleaned = String(v)
    .replace(/[₱$€£¥₩,%]/g, '')
    .replace(/\s*(pesos?|php|ng|manila|months?|yrs?|years?|kg|kilos?|lbs?|g\b|units?|pcs?|pieces?|hours?|days?|items?|bags?|packs?)\b/gi, '')
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

// Anchored checks -- /beneficiar/i alone also matches "Non-Beneficiary",
// which would silently drop the whole control group from the matching.
export const isBeneficiary = (value) => /^beneficiar/i.test(String(value ?? '').trim());
export const isNonBeneficiary = (value) =>
  /^non[- ]?beneficiar/i.test(String(value ?? '').trim()) || /^control/i.test(String(value ?? '').trim());

export const toLogit = (p) => {
  const x = Math.min(Math.max(p, 1e-6), 1 - 1e-6);
  return Math.log(x / (1 - x));
};

const mean = (arr) => arr.reduce((acc, x) => acc + x, 0) / arr.length;

const stdev = (arr) => {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, x) => acc + (x - m) * (x - m), 0) / (arr.length - 1));
};

// ---------------------------------------------------------------------------
// Student's t two-tailed p-value (regularized incomplete beta, NR style)
// ---------------------------------------------------------------------------
function lgamma(x) {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += cof[j] / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a, b, x) {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function betai(a, b, x) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(
    lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}

const pairedTTestPValue = (diffs) => {
  const n = diffs.length;
  if (n < 2) return null;
  const m = mean(diffs);
  const s = stdev(diffs);
  if (s === 0) return m === 0 ? 1 : 0;
  const t = m / (s / Math.sqrt(n));
  const df = n - 1;
  const x = df / (df + t * t);
  return Math.min(1, 2 * betai(df / 2, 0.5, x));
};

const bootstrapCi = (diffs, nBoot = 999, seed = 42) => {
  let state = seed;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const means = [];
  for (let b = 0; b < nBoot; b++) {
    let sum = 0;
    for (let i = 0; i < diffs.length; i++) sum += diffs[(rand() * diffs.length) | 0];
    means.push(sum / diffs.length);
  }
  means.sort((a, b) => a - b);
  const lo = Math.floor(0.025 * nBoot);
  const hi = Math.floor(0.975 * nBoot);
  return [means[lo], means[hi]];
};

// ---------------------------------------------------------------------------
// 1-nearest-neighbour matching on the logit scale, within a caliper.
// Controls are matched with replacement (mirrors the ML service).
// Binary search on a sorted control array keeps it O(n log n).
// ---------------------------------------------------------------------------
export const matchPairs = (psLogit, treatedIdx, controlIdx, caliper) => {
  if (!treatedIdx.length || !controlIdx.length) return [];
  const sortedControls = controlIdx
    .map((idx) => ({ idx, v: psLogit[idx] }))
    .sort((a, b) => a.v - b.v);
  const keys = sortedControls.map((s) => s.v);
  const pairs = [];
  for (const t of treatedIdx) {
    const v = psLogit[t];
    let lo = 0;
    let hi = keys.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (keys[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    let best = null;
    for (const pos of [lo, lo - 1]) {
      if (pos >= 0 && pos < keys.length) {
        const d = Math.abs(keys[pos] - v);
        if (d <= caliper && (best === null || d < best.d)) best = { idx: sortedControls[pos].idx, d };
      }
    }
    if (best) pairs.push([t, best.idx]);
  }
  return pairs;
};

const RATIOS = [0.2, 0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 20];
const ABSOLUTE_CALIPERS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50];

const candidateCalipers = (sd, preferredRatio) => {
  const list = [];
  const push = (c) => {
    if (!Number.isFinite(c) || c <= 0) return;
    const key = Math.round(c * 1e6);
    if (!list.some((x) => Math.round(x * 1e6) === key)) list.push(c);
  };
  push(preferredRatio * sd);
  RATIOS.forEach((r) => push(r * sd));
  ABSOLUTE_CALIPERS.forEach((c) => push(c));
  return list;
};

// ---------------------------------------------------------------------------
// Local ATT + matched-pair details + summary (replaces the service's empty
// bucket when it produced no pairs).
// ---------------------------------------------------------------------------
const computeLocalAtt = ({ rows, ps, treatedIdx, controlIdx, outcomeColumn, preferredRatio = 0.2 }) => {
  const psLogit = ps.map(toLogit);
  const sd = stdev(psLogit);

  let pairs = [];
  let caliperUsed = null;
  for (const cal of candidateCalipers(sd, preferredRatio)) {
    const result = matchPairs(psLogit, treatedIdx, controlIdx, cal);
    if (result.length) {
      pairs = result;
      caliperUsed = cal;
      break;
    }
  }

  const outcomeValues = rows.map((r) => toNumLoose(r?.[outcomeColumn]));

  if (!pairs.length) {
    return {
      att: {
        matched_pairs: 0,
        att_mean: null,
        ci_95: null,
        p_value_paired_ttest: null,
        caliper: null,
        note: 'Could not find any matched pairs even with a relaxed caliper.',
      },
      pairProfiles: [],
      profilingSummary: { increased_count: 0, decreased_count: 0, no_change_count: 0 },
      pairs,
      caliper: null,
    };
  }

  const pairProfiles = [];
  const diffs = [];
  for (const [t, c] of pairs) {
    const tOut = outcomeValues[t];
    const cOut = outcomeValues[c];
    let diff = null;
    let status = 'No Change';
    if (tOut !== null && cOut !== null) {
      diff = tOut - cOut;
      status = diff > 0 ? 'Increased' : diff < 0 ? 'Decreased' : 'No Change';
      diffs.push(diff);
    }
    pairProfiles.push({
      treated_index: t,
      control_index: c,
      treated_outcome: tOut,
      control_outcome: cOut,
      outcome_difference: diff,
      status,
    });
  }

  let attMean = null;
  let ci95 = null;
  let pValue = null;
  if (diffs.length >= 1) {
    attMean = mean(diffs);
  }
  if (diffs.length >= 2) {
    ci95 = bootstrapCi(diffs);
    pValue = pairedTTestPValue(diffs);
  }

  const profilingSummary = {
    increased_count: pairProfiles.filter((p) => p.status === 'Increased').length,
    decreased_count: pairProfiles.filter((p) => p.status === 'Decreased').length,
    no_change_count: pairProfiles.filter((p) => p.status === 'No Change').length,
  };

  return {
    att: {
      matched_pairs: pairs.length,
      att_mean: attMean,
      ci_95: ci95,
      p_value_paired_ttest: pValue,
      caliper: caliperUsed,
      note: 'Computed from the actual responses (caliper relaxed until matched pairs were found).',
    },
    pairProfiles,
    profilingSummary,
    pairs,
    caliper: caliperUsed,
  };
};

// ---------------------------------------------------------------------------
// Pre-Post Change Profile
// ---------------------------------------------------------------------------
const friendlyName = (col) => {
  let name = String(col || '');
  if (name.includes(':')) name = name.slice(name.indexOf(':') + 1).trim();
  name = name.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) return String(col);
  return name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// Detects A/B wave-pair columns the way the ML service does, but more
// forgivingly. A column produces "before"/"after" side keys when its label
// carries a wave marker in any of the shapes the questionnaire uses:
//   - "D2.3A: FRIDGE" / "D2.3B: FRIDGE"      (A/B appended to the code)
//   - "C1: A Income" / "C1: B Income"        (leading letter in the title)
//   - "D1: Income before" / "D1: Income current" (keyword waves)
// Two columns are a pair when a "before" key of one equals an "after" key of
// the other (keys are code + normalized rest, so unrelated columns never
// collide). Col A / "before" is the pre wave.
export const findWavePairsLocal = (columns) => {
  const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const BEFORE_WORDS = /\b(before|bago|pre|prior|baseline)\b/i;
  const AFTER_WORDS = /\b(current|after|present|post|now|kasalukuyan)\b/i;

  const sideEntries = (name) => {
    const s = String(name || '').trim();
    const ci = s.indexOf(':');
    const code = (ci === -1 ? s : s.slice(0, ci)).trim();
    const title = (ci === -1 ? '' : s.slice(ci + 1)).trim();
    const entries = [];
    const pushKey = (sideLetter, keyCodePart, rest) => {
      const rest2 = String(rest || '').replace(/^[AB](?::|\b)\s*/i, '').trim();
      if (rest2.trim() === '') return;
      const base = norm(rest2);
      if (!base) return;
      entries.push({ side: sideLetter === 'A' ? 'before' : 'after', key: `${norm(keyCodePart)}\u00a7${base}` });
    };
    const codeM = /^(.*?)([AB])$/.exec(code);
    if (codeM && /^[AB]$/.test(codeM[2])) pushKey(codeM[2], codeM[1], title || codeM[1]);
    const leadM = /^([AB])(?::|\b)\s*(.*)$/i.exec(title);
    if (leadM && /^[AB]$/i.test(leadM[1])) pushKey(leadM[1].toUpperCase(), code, leadM[2]);
    const bM = BEFORE_WORDS.exec(title);
    if (bM) pushKey('A', code, title.slice(0, bM.index) + title.slice(bM.index + bM[0].length));
    const aM = AFTER_WORDS.exec(title);
    if (aM) pushKey('B', code, title.slice(0, aM.index) + title.slice(aM.index + aM[0].length));
    return entries;
  };

  const sides = new Map();
  columns.forEach((c) => sides.set(c, sideEntries(c)));
  const pairs = [];
  const seen = new Set();
  const addPair = (aCol, bCol) => {
    if (!aCol || !bCol || aCol === bCol) return;
    const key = `${aCol}\u0000${bCol}`;
    if (!seen.has(key)) {
      seen.add(key);
      pairs.push([aCol, bCol]);
    }
  };
  for (const [col, entries] of sides.entries()) {
    const beforeKeys = entries.filter((e) => e.side === 'before');
    if (!beforeKeys.length) continue;
    for (const [other, otherEntries] of sides.entries()) {
      if (other === col) continue;
      for (const bk of beforeKeys) {
        if (otherEntries.some((e) => e.side === 'after' && e.key === bk.key)) {
          addPair(col, other);
          break;
        }
      }
    }
  }
  return pairs;
};

const computeWaveProfile = (rows, wavePairs, pairs) => {
  const treatedIdxs = pairs.map((p) => p[0]);
  const controlIdxs = pairs.map((p) => p[1]);
  const results = [];
  for (const [colPre, colPost] of wavePairs) {
    const pre = rows.map((r) => toNumLoose(r?.[colPre]));
    const post = rows.map((r) => toNumLoose(r?.[colPost]));
    const tally = (idxs) => {
      let increased = 0;
      let decreased = 0;
      let noChange = 0;
      let total = 0;
      for (const i of idxs) {
        const pv = pre[i];
        const nv = post[i];
        if (pv === null || nv === null) continue;
        total++;
        if (nv > pv) increased++;
        else if (nv < pv) decreased++;
        else noChange++;
      }
      return { increased, decreased, no_change: noChange, total };
    };
    const treated = tally(treatedIdxs);
    const control = tally(controlIdxs);
    if (!treated.total && !control.total) continue;
    results.push({
      feature: friendlyName(colPre),
      col_pre: colPre,
      col_post: colPost,
      treated,
      control,
    });
  }
  return results;
};

const computePairwiseProfile = (rows, columns, pairs, maxFeatures = 40) => {
  const results = [];
  const cols = columns.filter((c) => c !== 'Status');
  for (const col of cols) {
    let tInc = 0;
    let tDec = 0;
    let tSame = 0;
    let tTotal = 0;
    let cInc = 0;
    let cDec = 0;
    let cSame = 0;
    let cTotal = 0;
    for (const [t, c] of pairs) {
      const tv = toNumLoose(rows[t]?.[col]);
      const cv = toNumLoose(rows[c]?.[col]);
      if (tv === null || cv === null) continue;
      tTotal++;
      cTotal++;
      if (tv > cv) {
        tInc++;
        cDec++;
      } else if (tv < cv) {
        tDec++;
        cInc++;
      } else {
        tSame++;
        cSame++;
      }
    }
    if (!tTotal && !cTotal) continue;
    results.push({
      feature: friendlyName(col),
      col_pre: col,
      col_post: col,
      treated: { increased: tInc, decreased: tDec, no_change: tSame, total: tTotal },
      control: { increased: cInc, decreased: cDec, no_change: cSame, total: cTotal },
    });
  }
  return results.slice(0, maxFeatures);
};

// ---------------------------------------------------------------------------
// Main entry point: enrich a /train result so the Impact tab always renders.
// ---------------------------------------------------------------------------
export const enrichImpact = (result, dataset, outcomeColumn, preferredRatio = 0.2) => {
  if (!result || !dataset) return result;
  const rows = dataset.rows || [];
  const ps = result.ps_output && result.ps_output.ps;
  if (!rows.length || !Array.isArray(ps) || ps.length !== rows.length) return result;

  const treatedIdx = [];
  const controlIdx = [];
  rows.forEach((r, i) => {
    if (isBeneficiary(r?.Status)) treatedIdx.push(i);
    else if (isNonBeneficiary(r?.Status)) controlIdx.push(i);
  });
  if (!treatedIdx.length || !controlIdx.length) return result;

  const servicePairs = Number(result.att_result && result.att_result.matched_pairs || 0) > 0;
  const servicePairProfiles = Array.isArray(result.pair_profiles) && result.pair_profiles.length > 0;

  let pairs;
  let att;
  let pairProfiles;
  let profilingSummary;

  if (servicePairs && servicePairProfiles) {
    pairs = result.pair_profiles.map((p) => [Number(p.treated_index), Number(p.control_index)]);
    att = result.att_result;
    pairProfiles = result.pair_profiles;
    const pp = result.profiling_summary;
    profilingSummary =
      pp && (pp.increased_count !== undefined || pp.decreased_count !== undefined)
        ? pp
        : {
            increased_count: pairProfiles.filter((p) => p.status === 'Increased').length,
            decreased_count: pairProfiles.filter((p) => p.status === 'Decreased').length,
            no_change_count: pairProfiles.filter((p) => p.status === 'No Change').length,
          };
  } else {
    const local = computeLocalAtt({
      rows,
      ps,
      treatedIdx,
      controlIdx,
      outcomeColumn,
      preferredRatio,
    });
    pairs = local.pairs;
    att = { ...local.att, source: 'computed-from-responses' };
    pairProfiles = local.pairProfiles;
    profilingSummary = local.profilingSummary;
  }

  let profileUpdates = Array.isArray(result.profile_updates) ? result.profile_updates : [];
  if (!profileUpdates.length && pairs.length) {
    const wavePairs = result.profile_updates_wave_pairs || findWavePairsLocal(dataset.columns || []);
    const wave = wavePairs.length ? computeWaveProfile(rows, wavePairs, pairs) : [];
    // Also profile the non-wave columns as a treated-vs-control pairwise
    // comparison so the Pre-Post table never comes back empty.
    const usedColumns = new Set();
    wavePairs.forEach(([a, b]) => { usedColumns.add(a); usedColumns.add(b); });
    const otherColumns = (dataset.columns || []).filter((c) => c !== 'Status' && !usedColumns.has(c));
    profileUpdates = [...wave, ...computePairwiseProfile(rows, otherColumns, pairs)];
  }

  const mergedResult = {
    ...result,
    att_result: att,
    pair_profiles: pairProfiles,
    profiling_summary: profilingSummary,
    profile_updates: profileUpdates,
    impact_enrichment: { enabled: true, preferred_ratio: preferredRatio },
  };

  // Keep the Metrics-tab matched-pair counter consistent when we had to
  // compute the pairs ourselves.
  if (result.covariate_balance && att && att.caliper !== undefined && !servicePairs) {
    mergedResult.covariate_balance = {
      ...result.covariate_balance,
      matched_pairs: att.matched_pairs,
      caliper: att.caliper,
    };
  }

  return mergedResult;
};