// Code.gs 0.1.4
const SHEET_NAME = 'submissions';
const PROPS = PropertiesService.getScriptProperties();
const FALLBACK_ALLOWED_SPREADSHEET_ID = '';
const FALLBACK_ALLOWED_SPREADSHEET_NAME = '';

function doGet(e) {
  const isStats = e && e.parameter && /^(1|true|yes|on)$/i.test(String(e.parameter.stats || '').trim());
  if (isStats) {
    enforceWorkbookBinding_();
    const days = getConfiguredStatsWindowDays_();
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, service: 'my-world-heritage-usage-summary', stats: buildRecentStats_(days) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'my-world-heritage-usage-summary' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    enforceWorkbookBinding_();
    const payload = parsePayload_(e);
    enforcePayloadSize_(e);
    validateToken_(payload);
    validatePayload_(payload);
    enforceRateLimits_(payload);
    const statsWindowDays = getConfiguredStatsWindowDays_();
    if (isDuplicate_(payload)) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, duplicate: true, stats: buildRecentStats_(statsWindowDays) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    appendSubmission_(payload);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, stats: buildRecentStats_(statsWindowDays) }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    console.error('doPost error: ' + String(err && err.message || err));
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err && err.message || err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function parsePayload_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  return JSON.parse(raw);
}

function enforcePayloadSize_(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
  const maxBytes = getIntProp_('MWH_MAX_PAYLOAD_BYTES', 4096, 512, 65536);
  if (raw.length > maxBytes) throw new Error('Payload too large.');
}

function validatePayload_(p) {
  if (!p || typeof p !== 'object') throw new Error('Payload is required.');
  getSubmittedAtUtc_(p);
  if (!/^[a-fA-F0-9]{16,64}$/.test(String(p.magic_cookie || ''))) throw new Error('magic_cookie must be hex.');
  if (!Number.isInteger(p.use_count_since_last_push) || p.use_count_since_last_push < 0) throw new Error('use_count_since_last_push must be a non-negative integer.');
  const hasVisited = Number.isInteger(p.visited_site_count) && p.visited_site_count >= 0;
  const hasTotal = Number.isInteger(p.total_site_count) && p.total_site_count >= 0;
  if (!hasVisited && !hasTotal) throw new Error('visited_site_count (or legacy total_site_count) must be a non-negative integer.');
}

function validateToken_(p) {
  const expected = String(PROPS.getProperty('MWH_INGEST_TOKEN') || '').trim();
  if (!expected) return;
  if (String(p.token || '') !== expected) throw new Error('Invalid token.');
}

function enforceRateLimits_(p) {
  const cache = CacheService.getScriptCache();
  const cookie = String(p.magic_cookie || '');
  const nowMs = Date.now();
  const minIntervalSec = getIntProp_('MWH_MIN_INTERVAL_SECONDS', 30, 1, 3600);
  const perHourMax = getIntProp_('MWH_MAX_SUBMISSIONS_PER_COOKIE_PER_HOUR', 12, 1, 1000);

  const lastKey = 'last:' + cookie;
  const lastRaw = cache.get(lastKey);
  if (lastRaw) {
    const lastMs = Number(lastRaw);
    if (Number.isFinite(lastMs) && (nowMs - lastMs) < (minIntervalSec * 1000)) throw new Error('Rate limited (minimum interval).');
  }
  cache.put(lastKey, String(nowMs), Math.max(minIntervalSec, 1));

  const bucket = Utilities.formatDate(new Date(nowMs), 'UTC', 'yyyyMMddHH');
  const countKey = 'count:' + cookie + ':' + bucket;
  const count = Number(cache.get(countKey) || '0');
  if (count >= perHourMax) throw new Error('Rate limited (hourly cap).');
  cache.put(countKey, String(count + 1), 3600);
}

function isDuplicate_(p) {
  const cache = CacheService.getScriptCache();
  const keyMaterial = JSON.stringify([
    getSubmittedAtUtc_(p).toISOString(),
    String(p.magic_cookie || ''),
    Number(p.use_count_since_last_push || 0),
    getVisitedSiteCount_(p)
  ]);
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, keyMaterial);
  const hex = digest.map(function(b) {
    const v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
  const dupKey = 'dup:' + hex;
  if (cache.get(dupKey)) return true;
  const dupTtl = getIntProp_('MWH_DUPLICATE_TTL_SECONDS', 3600, 60, 86400);
  cache.put(dupKey, '1', dupTtl);
  return false;
}

function getIntProp_(name, fallback, min, max) {
  const raw = Number(PROPS.getProperty(name));
  let v = Number.isFinite(raw) ? Math.floor(raw) : fallback;
  if (Number.isFinite(min)) v = Math.max(min, v);
  if (Number.isFinite(max)) v = Math.min(max, v);
  return v;
}

function appendSubmission_(p) {
  enforceWorkbookBinding_();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow([
      'received_at_utc',
      'submitted_at_utc',
      'magic_cookie',
      'use_count_since_last_push',
      'visited_site_count',
      'event_type',
      'source',
      'user_agent',
      'token_used'
    ]);
  }
  const eventType = String(p.event_type || 'periodic').trim() || 'periodic';
  sh.appendRow([
    new Date(),
    getSubmittedAtUtc_(p),
    String(p.magic_cookie),
    Number(p.use_count_since_last_push),
    getVisitedSiteCount_(p),
    eventType,
    String(p.source || 'web-app'),
    String(p.user_agent || ''),
    String(p.token ? 'yes' : 'no')
  ]);
}

function sendPeriodicDigest() {
  enforceWorkbookBinding_();
  const reportEmail = String(PROPS.getProperty('MWH_REPORT_EMAIL') || '').trim();
  if (!reportEmail) throw new Error('Set script property MWH_REPORT_EMAIL.');

  const days = Math.max(1, Number(PROPS.getProperty('MWH_REPORT_DAYS') || 7));
  const sinceMs = Date.now() - (days * 24 * 60 * 60 * 1000);
  const sinceIso = new Date(sinceMs).toISOString();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) {
    MailApp.sendEmail({
      to: reportEmail,
      subject: 'My World Heritage usage digest',
      body: `No submissions found in the last ${days} day(s).`
    });
    PROPS.setProperty('MWH_LAST_DIGEST_AT', new Date().toISOString());
    return;
  }

  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  const recent = rows.filter((r) => {
    const t = toMillis_(r[0]);
    return Number.isFinite(t) && t >= sinceMs;
  });

  const uniqueCookies = new Set(recent.map((r) => String(r[2] || '')).filter(Boolean));
  const totalUses = recent.reduce((sum, r) => sum + Number(r[3] || 0), 0);
  const avgVisited = recent.length ? (recent.reduce((sum, r) => sum + Number(r[4] || 0), 0) / recent.length) : 0;

  const body = [
    `Period: ${sinceIso} to ${new Date().toISOString()}`,
    `Submissions: ${recent.length}`,
    `Unique datasets (magic cookie): ${uniqueCookies.size}`,
    `Aggregated use_count_since_last_push: ${totalUses}`,
    `Average visited_site_count: ${avgVisited.toFixed(1)}`,
    '',
    'This digest is pseudonymised usage telemetry from My World Heritage.'
  ].join('\n');

  MailApp.sendEmail({
    to: reportEmail,
    subject: 'My World Heritage usage digest',
    body: body
  });
  PROPS.setProperty('MWH_LAST_DIGEST_AT', new Date().toISOString());
}

function getVisitedSiteCount_(p) {
  const visited = Number(p.visited_site_count);
  if (Number.isInteger(visited) && visited >= 0) return visited;
  const legacyTotal = Number(p.total_site_count);
  if (Number.isInteger(legacyTotal) && legacyTotal >= 0) return legacyTotal;
  return 0;
}

function getSubmittedAtUtc_(p) {
  const ts = String(p.submitted_at_utc || '').trim();
  if (ts) {
    const ms = Date.parse(ts);
    if (!Number.isFinite(ms)) throw new Error('submitted_at_utc must be an ISO timestamp.');
    return new Date(ms);
  }
  const legacyDate = String(p.date || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(legacyDate)) return new Date(legacyDate + 'T00:00:00Z');
  throw new Error('submitted_at_utc is required (ISO timestamp).');
}

function toMillis_(value) {
  if (value instanceof Date) return value.getTime();
  const t = Date.parse(String(value || ''));
  return Number.isFinite(t) ? t : NaN;
}

function getConfiguredStatsWindowDays_() {
  const raw = Number(PROPS.getProperty('MWH_STATS_WINDOW_DAYS'));
  if (!Number.isFinite(raw)) return 14;
  return Math.max(1, Math.min(365, Math.floor(raw)));
}

function buildRecentStats_(days) {
  const windowDays = Math.max(1, Math.min(365, Number(days) || 14));
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) {
    return { window_days: windowDays, submissions: 0, active_datasets: 0, unique_datasets: 0 };
  }
  const sinceMs = Date.now() - (windowDays * 24 * 60 * 60 * 1000);
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues();
  let submissions = 0;
  const cookies = new Set();
  for (const r of rows) {
    const t = toMillis_(r[0]);
    if (!Number.isFinite(t) || t < sinceMs) continue;
    submissions += 1;
    const cookie = String(r[2] || '').trim();
    if (cookie) cookies.add(cookie);
  }
  return {
    window_days: windowDays,
    submissions: submissions,
    active_datasets: cookies.size,
    unique_datasets: cookies.size,
    encouragement: `Active datasets in last ${windowDays} days: ${cookies.size}. Submissions in window: ${submissions}.`
  };
}

function backendSelfTestDryRun() {
  enforceWorkbookBinding_();
  const payload = {
    submitted_at_utc: new Date().toISOString(),
    magic_cookie: 'abcdef0123456789',
    use_count_since_last_push: 0,
    visited_site_count: 0,
    event_type: 'manual',
    source: 'backend-self-test',
    user_agent: 'apps-script'
  };
  const expectedToken = String(PROPS.getProperty('MWH_INGEST_TOKEN') || '').trim();
  if (expectedToken) payload.token = expectedToken;
  validatePayload_(payload);
  validateToken_(payload);
  return {
    ok: true,
    workbook_id: SpreadsheetApp.getActiveSpreadsheet().getId(),
    workbook_name: SpreadsheetApp.getActiveSpreadsheet().getName(),
    endpoint_ready: true,
    token_required: !!expectedToken
  };
}

function backendSelfTestAppend() {
  const dry = backendSelfTestDryRun();
  const payload = {
    submitted_at_utc: new Date().toISOString(),
    magic_cookie: 'abcdef0123456789',
    use_count_since_last_push: 0,
    visited_site_count: 0,
    event_type: 'manual',
    source: 'backend-self-test',
    user_agent: 'apps-script'
  };
  const expectedToken = String(PROPS.getProperty('MWH_INGEST_TOKEN') || '').trim();
  if (expectedToken) payload.token = expectedToken;
  validatePayload_(payload);
  validateToken_(payload);
  appendSubmission_(payload);
  return {
    ok: true,
    appended: true,
    workbook_id: dry.workbook_id,
    workbook_name: dry.workbook_name
  };
}

function installDailyDigestTrigger() {
  enforceWorkbookBinding_();
  const existing = ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'sendPeriodicDigest');
  for (const t of existing) ScriptApp.deleteTrigger(t);
  ScriptApp.newTrigger('sendPeriodicDigest').timeBased().everyDays(1).atHour(8).create();
}

function enforceWorkbookBinding_() {
  const allowedId = String(PROPS.getProperty('MWH_ALLOWED_SPREADSHEET_ID') || FALLBACK_ALLOWED_SPREADSHEET_ID || '').trim();
  if (!allowedId) throw new Error('Set script property MWH_ALLOWED_SPREADSHEET_ID.');
  const allowedName = String(PROPS.getProperty('MWH_ALLOWED_SPREADSHEET_NAME') || FALLBACK_ALLOWED_SPREADSHEET_NAME || '').trim();

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No active spreadsheet context.');
  const activeId = String(ss.getId() || '').trim();
  if (activeId !== allowedId) throw new Error('Workbook id mismatch.');
  if (allowedName) {
    const activeName = String(ss.getName() || '').trim();
    if (activeName !== allowedName) throw new Error('Workbook name mismatch.');
  }
}


