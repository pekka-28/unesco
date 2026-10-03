import type {SiteProperties, Site, Catalogue, Visit, Profile, Place, LocationMatch, ReportRow, Summary, UsageStats, SubmissionResult, WhsResult, GeoResult, Receipt, StatsResponse, HistogramResponse, StoredStatus, ExtractDocument} from './types.js';
declare const html2canvas: typeof import('html2canvas').default;
function element<K extends keyof HTMLElementTagNameMap>(id: string, tag: K): HTMLElementTagNameMap[K] {
  const found = document.getElementById(id);
  if (!found || found.tagName.toLowerCase() !== tag) throw new Error('Missing '+tag+' #'+id);
  return found as HTMLElementTagNameMap[K];
}
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

    const USAGE_SUMMARY_ENDPOINTS = Object.freeze({
      current: "https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/usage-summary",
      previous: "https://script.google.com/macros/s/AKfycbzPtSZnPoymM9sw2NV2GpSXVsDKAps9txWh_oSmCUw2PvkCjzuM_KHfhVd4MC5Y7BbF/exec"
    });
    const USAGE_ENDPOINT_STORAGE_KEY = "mwh_usage_summary_endpoint";
    const PROFILE_KEY = "mwh_profile";
    const CENSUS_KEY = "mwh_census";
    const MAP_VIEW_KEY = "mwh_map_view";
    const USAGE_SUBMIT_STATUS_KEY = "mwh_usage_submit_status";
    const APP_VERSION = "0.2.6";
    const APP_NAME = "My World Heritage";
    const APP_TITLE_SEPARATOR = " \u2013 ";
    const REPORT_TILE_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}";
    const PROFILE_SCHEMA_VERSION = 1;
    const FEATURE_FLAG_PREFIX = "mwh_flag_";
    const CRITERIA_URL = "https://whc.unesco.org/en/criteria/";
    const criteriaTitles: Record<string, string> = { i: "Masterpiece of human creative genius", ii: "Interchange of human values", iii: "Exceptional testimony to a tradition or civilisation", iv: "Outstanding example illustrating stages in history", v: "Outstanding settlement, land-use, or sea-use example", vi: "Association with events, traditions, ideas, or beliefs", vii: "Exceptional natural beauty", viii: "Earth history and geomorphic processes", ix: "Ecological and biological processes", x: "In-situ biodiversity conservation" };
    const map = L.map("map").setView([20, 0], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors", crossOrigin: "anonymous" }).addTo(map);
    let scaleControl: L.Control.Scale | null = null;
    const ui = {
      detailPane: element("detail-pane", "div"), searchInput: element("search-input", "input"), searchResults: element("search-results", "div"), loadingIndicator: element("loading-indicator", "div"),
      helpOverlay: element("help-overlay", "div"), settingsOverlay: element("settings-overlay", "div"), enrolOverlay: element("enrol-overlay", "div"), userMenuToggle: element("user-menu-toggle", "button"),
      userMenu: element("user-menu", "div"), menuSummary: element("menu-summary", "button"), menuSubmit: element("menu-submit", "button"), menuReset: element("menu-reset", "button"), importFile: element("import-file", "input"), userName: element("user-name", "input"),
      brandMarkWrap: element("brand-mark-wrap", "div"), brandMarkBtn: element("brand-mark-btn", "button"),
      homeQuery: element("home-query", "input"), homeMatchesList: element("home-matches", "datalist"), homeSelected: element("home-selected", "div"),
      locStatus: element("loc-status", "span"), visitedOnlySetting: element("visited-only-setting", "input"),
      shareEnabled: element("share-enabled", "input"), shareInterval: element("share-interval", "input"), shareNone: element("share-none", "input"), shareEndpoint: element("share-endpoint", "input"), shareToken: element("share-token", "input"), shareSubmitStatus: element("share-submit-status", "div"),
      shareInfoLink: element("share-info-link", "button"), shareInfoBubble: element("share-info-bubble", "div"),
      summaryInboxBtn: element("summary-inbox-btn", "button"), summaryInboxDot: element("summary-inbox-dot", "span"),
      submitOverlay: element("submit-overlay", "div"), submitSummary: element("submit-summary", "div"), submitStatus: element("submit-status", "div"), submitSend: element("submit-send", "button"), submitClose: element("submit-close", "button"),
      enrolUserName: element("enrol-user-name", "input"), enrolHomeQuery: element("enrol-home-query", "input"), enrolHomeSuggestions: element("enrol-home-suggestions", "div"),
      enrolLocStatus: element("enrol-loc-status", "span"), enrolHomeSelected: element("enrol-home-selected", "div"), enrolNearbyList: element("enrol-nearby-list", "div"),
      siteListMode: element("site-list-mode", "select"), appTitleBtn: element("app-title-btn", "button"),
      extractStatusResult: element("extract-status-result", "div"), extractStatusSource: element("extract-status-source", "div"),
      extractStatusCount: element("extract-status-count", "div"), extractStatusInput: element("extract-status-input", "div"),
      extractStatusSize: element("extract-status-size", "div"), extractStatusDataAt: element("extract-status-data-at", "div"),
      extractStatusAttemptAt: element("extract-status-attempt-at", "div"), extractStatusRetry: element("extract-status-retry", "div"),
      dateFormat: element("date-format", "select"), lengthUnits: element("length-units", "select"), multipleThreshold: element("multiple-threshold", "input"),
      appVersion: element("app-version", "span")
    };
    let whsData: Catalogue | null = null, layer: L.GeoJSON | null = null, markersBySiteId = new Map<string, L.CircleMarker<SiteProperties>>(), profile: Profile | null = null, connected = false, manuallyDisconnected = false, selectedHome: Place | null = null, homeMatches: LocationMatch[] = [], enrolSelectedHome: Place | null = null, enrolMatches: LocationMatch[] = [], lastSearchedSiteIds: string[] = [], searchFocusBySiteId = new Map<string, {lat: number; lon: number}>(), ignoreMapClickUntil = 0, selectedSiteId: string | null = null, listSortBy = "name", listSortDir = "asc", selectionContext = "";
    let homeMatchIndexByLabel = new Map<string, number>(), enrolMatchIndexByLabel = new Map<string, number>();
    let summaryReminderTimer: number | null = null, pendingSummaryDialog: {summary: Summary} | null = null, submissionInProgress = false;
    let componentCountByRootId = new Map<string, number>(), highVolumeComponentSiteIds = new Set<string>(), explicitVisibleSiteIds = new Set<string>();
    const asText = (v: unknown) => v == null ? "" : String(v);
    const nowIso = () => new Date().toISOString();
    function buildAppTitle(userName = "") {
      const who = asText(userName).trim();
      return who ? `${APP_NAME}${APP_TITLE_SEPARATOR}${who}` : APP_NAME;
    }
    function getBooleanFlag(name: string, fallback = false) {
      const qp = new URLSearchParams(window.location.search);
      const qv = qp.get(name);
      if (qv != null) return /^(1|true|yes|on)$/i.test(asText(qv));
      const sv = localStorage.getItem(`${FEATURE_FLAG_PREFIX}${name}`);
      if (sv != null) return /^(1|true|yes|on)$/i.test(asText(sv));
      return fallback;
    }
    const flags = { submitEnabled: getBooleanFlag("submit", true), resetEnabled: getBooleanFlag("reset", false) };
    function applyFeatureFlags() {
      if (ui.menuSubmit) ui.menuSubmit.style.display = flags.submitEnabled ? "block" : "none";
      if (ui.menuReset) ui.menuReset.style.display = flags.resetEnabled ? "block" : "none";
    }
    function rawDisplayName(p: SiteProperties) {
      const en = asText(p && p.name_en);
      const nm = asText(p && p.name);
      if (en) return en;
      if (nm) return nm;
      return "Unnamed site";
    }
    function splitComponentName(raw: unknown) {
      const text = asText(raw);
      const ix = text.indexOf(" - ");
      if (ix <= 0) return null;
      return { root: text.slice(0, ix).trim(), child: text.slice(ix + 3).trim() };
    }
    function sanitizeSiteName(value: unknown) {
      return asText(value).replace(/\\/g, "").replace(/\s{2,}/g, " ").trim();
    }
    function foldTextForCompare(value: unknown) {
      return asText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
    }
    function namesEquivalent(a: unknown, b: unknown) {
      const aa = foldTextForCompare(a);
      const bb = foldTextForCompare(b);
      return !!aa && !!bb && aa === bb;
    }
    const WHS_ID_RE = /^WHS\s+(\d{1,6})$/;
    const MWH_ID_RE = /^MWH\s+(\d{1,6})-(\d{3})$/;
    function isValidSiteId(id: unknown) {
      const t = asText(id).trim();
      return WHS_ID_RE.test(t) || MWH_ID_RE.test(t);
    }
    function assertValidSiteId(id: unknown, context = "site id") {
      const t = asText(id).trim();
      if (!isValidSiteId(t)) throw new Error(`Invalid ${context}: ${t || "<empty>"}`);
      return t;
    }
    function findFeatureBySiteId(siteId: string) {
      if (!whsData || !Array.isArray(whsData.features) || !siteId) return null;
      const wanted = asText(siteId).trim();
      if (!wanted) return null;
      return whsData.features.find((f) => asText(f && f.properties && f.properties.site_id).trim() === wanted) || null;
    }
    function displayName(p: SiteProperties) {
      const raw = rawDisplayName(p);
      if (asText(p && p.site_scope) === "component") {
        const parts = splitComponentName(raw);
        if (parts && parts.child) return sanitizeSiteName(parts.child);
      }
      return sanitizeSiteName(raw);
    }
    function detectNativeScriptName(p: SiteProperties, primaryName = "") {
      const mapped = asText(p && p.native_display).trim();
      if (mapped && !namesEquivalent(mapped, primaryName)) return mapped;
      const strongScript = /[\u0370-\u03FF\u0400-\u052F\u0590-\u08FF\u0900-\u0DFF\u0E00-\u0E7F\u1100-\u11FF\u2D30-\u2D7F\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;
      const nativeObj = p && typeof p.native_names === "object" ? p.native_names : null;
      const mappedFields = nativeObj ? [asText(nativeObj.name_ar), asText(nativeObj.name_ru), asText(nativeObj.name_zh)] : [];
      const candidates = [...mappedFields, asText(p && p.name), asText(p && p.name_en), ...(Array.isArray(p && p.aliases) ? (p.aliases || []).map(asText) : [])];
      for (const c of candidates) {
        const t = asText(c).trim();
        if (!t) continue;
        if (!strongScript.test(t)) continue;
        if (namesEquivalent(t, primaryName)) continue;
        return t;
      }
      const scope = asText(p && p.site_scope);
      const parentId = asText(p && p.parent_site_id);
      if (scope === "component" && parentId) {
        const parent = findFeatureBySiteId(parentId);
        const parentNative = asText(parent && parent.properties && parent.properties.native_display).trim();
        if (parentNative && strongScript.test(parentNative) && !namesEquivalent(parentNative, primaryName)) return parentNative;
      }
      return "";
    }
    function escapeHtml(text: unknown) {
      return asText(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function nbspHtml(text: unknown) {
      return escapeHtml(text).replace(/ /g, "&nbsp;");
    }
    function tooltipContent(feature: Site) {
      const p = feature && feature.properties ? feature.properties : {};
      const primary = displayName(p);
      const native = detectNativeScriptName(p, primary);
      const lines = [
        `<span dir="auto" style="display:block; font-size:13px; line-height:1.2;">${escapeHtml(primary)}</span>`
      ];
      if (native) lines.push(`<span dir="auto" style="display:block; font-size:13px; line-height:1.2;">${escapeHtml(native)}</span>`);
      return lines.join("");
    }
    function randomCookie() { const arr = new Uint8Array(16); crypto.getRandomValues(arr); return Array.from(arr).map(x => x.toString(16).padStart(2, "0")).join(""); }
    let loadingCounter = 0;
    function showLoading(text = "Loading ...") {
      loadingCounter += 1;
      ui.loadingIndicator.textContent = text;
      ui.loadingIndicator.style.display = "inline-flex";
    }
    function hideLoading() {
      loadingCounter = Math.max(0, loadingCounter - 1);
      if (loadingCounter === 0) {
        ui.loadingIndicator.textContent = "Loading ...";
        ui.loadingIndicator.style.display = "none";
      }
    }
    function defaultProfile(): Profile { return { schemaVersion: PROFILE_SCHEMA_VERSION, name: "", homeLat: null, homeLon: null, homeLabel: "", siteVisits: {}, inspectedSiteIds: [], settings: { visitedOnly: false, dateFormat: "y-m-d", lengthUnits: "km", multipleThreshold: 5, usageSummaryEndpoint: getUsageSummaryEndpoint(), usageSummaryToken: "" }, usage: { firstUseAt: nowIso(), lastUseAt: nowIso(), useCount: 0, inspectCount: 0, publishedUseCount: 0 }, publishPreference: { enabled: false, intervalDays: 7, lastPromptAt: null, consentAskedAtStartup: false }, magicCookie: randomCookie(), updatedAt: nowIso() }; }
    function incrementCensusUse() { let c = { schemaVersion: 1, useCount: 0, updatedAt: nowIso() }; try { c = JSON.parse(localStorage.getItem(CENSUS_KEY) || "null") || c; } catch {} c.useCount = Number(c.useCount || 0) + 1; c.updatedAt = nowIso(); localStorage.setItem(CENSUS_KEY, JSON.stringify(c)); }
    function verifyProfile(obj: Profile | null) {
      if (!obj || typeof obj !== "object") return { ok: false, reason: "Profile missing" };
      if (obj.schemaVersion !== PROFILE_SCHEMA_VERSION) return { ok: false, reason: `Unsupported profile version ${obj.schemaVersion}` };
      if (!Array.isArray(obj.inspectedSiteIds)) return { ok: false, reason: "Invalid profile arrays" };
      if (!obj.usage || typeof obj.usage !== "object") return { ok: false, reason: "Usage block missing" };
      if (obj.siteVisits != null && typeof obj.siteVisits !== "object") return { ok: false, reason: "Invalid site visits block" };
      try {
        for (const id of obj.inspectedSiteIds || []) assertValidSiteId(id, "inspected site id");
        for (const k of Object.keys(obj.siteVisits || {})) assertValidSiteId(k, "visit site id");
      } catch (e) {
        return { ok: false, reason: asText(errorMessage(e)) || "Invalid site id format in profile" };
      }
      return { ok: true };
    }
    function persistProfile() { if (!profile) return; migrateUsageSettings(profile); localStorage.setItem(USAGE_ENDPOINT_STORAGE_KEY, profile.settings.usageSummaryEndpoint); profile.updatedAt = nowIso(); localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
    function siteIdCaption(feature: Site) {
      const p = feature && feature.properties ? feature.properties : {};
      const id = assertValidSiteId(p.site_id, "detail site id");
      const scope = asText(p.site_scope);
      const parent = asText(p.parent_site_id);
      if (scope === "component" && parent) {
        if (!WHS_ID_RE.test(parent)) throw new Error(`Invalid component parent id in detail: ${parent}`);
        const rootFeature = findFeatureBySiteId(parent);
        const rootName = rootFeature ? displayName(rootFeature.properties || {}) : "";
        if (rootName) return `Site id ${id} (component of ${parent}: ${rootName})`;
        return `Site id ${id} (component of ${parent})`;
      }
      if (WHS_ID_RE.test(id)) return id;
      return `Site id ${id}`;
    }
    function setVisitStatus(siteId: string, status: string) {
      if (!(connected && profile) || !siteId) return;
      ensureVisitStructures();
      const list = Array.isArray(profile.siteVisits[siteId]) ? profile.siteVisits[siteId] : [];
      const latest = getLatestVisitEntry(siteId);
      const now = nowIso();
      if (!latest) {
        if (status !== "not_visited") {
          list.push({ id: crypto.randomUUID(), date: "", status, note: "", createdAt: now, updatedAt: now });
          profile.siteVisits[siteId] = list;
        }
      } else {
        const idx = list.findIndex((x) => asText(x.id) === asText(latest.id));
        if (idx >= 0) {
          list[idx].status = status;
          list[idx].updatedAt = now;
          profile.siteVisits[siteId] = list;
        }
      }
      persistProfile();
    }
    function ensureVisitStructures() {
      if (!profile) return;
      profile.siteVisits = profile.siteVisits || {};
    }
    function normalizeDateOnly(value: unknown) {
      const raw = asText(value).trim();
      if (!raw) return "";
      const y = raw.match(/^(\d{4})$/);
      if (y) return y[1];
      const ym = raw.match(/^(\d{4})-(\d{1,2})$/);
      if (ym) {
        const year = ym[1];
        const month = Number(ym[2]);
        if (Number.isNaN(month) || month < 0 || month > 12) return "";
        return `${year}-${String(month).padStart(2, "0")}`;
      }
      const ymd = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (ymd) {
        const year = Number(ymd[1]);
        const month = Number(ymd[2]);
        const day = Number(ymd[3]);
        if (Number.isNaN(month) || Number.isNaN(day) || month < 0 || month > 12 || day < 0 || day > 31) return "";
        if (month === 0 && day !== 0) return "";
        if (month > 0 && day > 0) {
          const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
          if (day > maxDay) return "";
        }
        return `${ymd[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      }
      return "";
    }
    function formatStatusLabel(status: unknown) {
      const s = asText(status);
      if (s === "wont_visit") return "Won't visit";
      const t = s.replace(/_/g, " ");
      return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Not visited";
    }
    function truncateText(value: unknown, maxLen: number) {
      const t = asText(value);
      return t.length <= maxLen ? t : `${t.slice(0, maxLen - 1)}...`;
    }
    function dateSortKey(raw: unknown) {
      const d = normalizeDateOnly(raw);
      if (!d) return "";
      const parts = d.split("-");
      if (parts.length === 1) return `${parts[0]}-00-00`;
      if (parts.length === 2) return `${parts[0]}-${parts[1]}-00`;
      return d;
    }
    function defaultVisitDateValue() {
      return new Date().toISOString().slice(0, 10);
    }
    function formatVisitDateForDisplay(raw: unknown) {
      const fmt = asText(profile && profile.settings && profile.settings.dateFormat) || "y-m-d";
      const d = normalizeDateOnly(raw);
      if (!d) return "";
      const parts = d.split("-");
      const y = parts[0] || "";
      const m = parts[1] || "";
      const day = parts[2] || "";
      if (parts.length === 1) return y;
      if (parts.length === 2) {
        if (fmt === "m-d-y") return `${m}-${y}`;
        if (fmt === "d-m-y") return `${m}-${y}`;
        return `${y}-${m}`;
      }
      if (fmt === "d-m-y") return `${day}-${m}-${y}`;
      if (fmt === "m-d-y") return `${m}-${day}-${y}`;
      return `${y}-${m}-${day}`;
    }
    function formatVisitDateForReport(raw: unknown) {
      const d = normalizeDateOnly(raw);
      if (!d) return "";
      const p = d.split("-");
      if (p.length === 1) return p[0];
      if (p.length === 2) {
        const dt = new Date(Number(p[0]), Number(p[1]) - 1, 1);
        if (Number.isNaN(dt.getTime())) return `${p[1]} ${p[0]}`;
        const mon = dt.toLocaleString(undefined, { month: "short" });
        return `${mon} ${p[0]}`;
      }
      const dt = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      if (Number.isNaN(dt.getTime())) return d;
      const day = dt.toLocaleString(undefined, { day: "numeric" });
      const mon = dt.toLocaleString(undefined, { month: "short" });
      const year = dt.toLocaleString(undefined, { year: "numeric" });
      return `${day} ${mon} ${year}`;
    }
    function formatTimestampLocal(raw: string | Date) {
      const dt = raw instanceof Date ? raw : new Date(raw);
      if (Number.isNaN(dt.getTime())) return asText(raw);
      const day = dt.toLocaleString(undefined, { day: "numeric" });
      const mon = dt.toLocaleString(undefined, { month: "short" });
      const year = dt.toLocaleString(undefined, { year: "numeric" });
      const time = dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
      return `${day} ${mon} ${year} ${time}`;
    }
    function formatTimestampUtc(raw: string | Date) {
      const dt = raw instanceof Date ? raw : new Date(raw);
      if (Number.isNaN(dt.getTime())) return asText(raw);
      const mon = dt.toLocaleString("en-GB", { timeZone: "UTC", month: "short" });
      const day = String(dt.getUTCDate());
      const year = String(dt.getUTCFullYear());
      const hh = String(dt.getUTCHours()).padStart(2, "0");
      const mm = String(dt.getUTCMinutes()).padStart(2, "0");
      return `${day} ${mon} ${year} ${hh}:${mm} UTC`;
    }
    function applyScaleUnits() {
      if (scaleControl) map.removeControl(scaleControl);
      const units = asText(profile && profile.settings && profile.settings.lengthUnits) || "km";
      if (units === "mi") scaleControl = L.control.scale({ metric: false, imperial: true });
      else scaleControl = L.control.scale({ metric: true, imperial: false });
      scaleControl.addTo(map);
    }
    function getSiteVisits(siteId: string) {
      if (!(connected && profile) || !siteId) return [];
      ensureVisitStructures();
      const visits = Array.isArray(profile.siteVisits[siteId]) ? profile.siteVisits[siteId] : [];
      return visits.slice().sort((a, b) => {
        const da = normalizeDateOnly(a.date);
        const db = normalizeDateOnly(b.date);
        if (da !== db) return db.localeCompare(da);
        return asText(b.updatedAt || b.createdAt).localeCompare(asText(a.updatedAt || a.createdAt));
      });
    }
    function getLatestVisitEntry(siteId: string) {
      const visits = getSiteVisits(siteId);
      return visits.length ? visits[0] : null;
    }
    function saveSiteVisit(siteId: string, visit: Partial<Visit>) {
      if (!(connected && profile) || !siteId) return;
      ensureVisitStructures();
      const list = Array.isArray(profile.siteVisits[siteId]) ? profile.siteVisits[siteId] : [];
      const clean = {
        id: asText(visit.id) || crypto.randomUUID(),
        date: normalizeDateOnly(visit.date),
        status: asText(visit.status) || "not_visited",
        note: asText(visit.note).trim(),
        createdAt: asText(visit.createdAt) || nowIso(),
        updatedAt: nowIso()
      };
      const idx = list.findIndex((x) => asText(x.id) === clean.id);
      if (idx >= 0) list[idx] = clean;
      else list.push(clean);
      profile.siteVisits[siteId] = list;
      persistProfile();
    }
    function deleteSiteVisit(siteId: string, visitId: string) {
      if (!(connected && profile) || !siteId || !visitId) return;
      ensureVisitStructures();
      const list = Array.isArray(profile.siteVisits[siteId]) ? profile.siteVisits[siteId] : [];
      profile.siteVisits[siteId] = list.filter((x) => asText(x.id) !== asText(visitId));
      if (!profile.siteVisits[siteId].length) delete profile.siteVisits[siteId];
      persistProfile();
    }
    function setTitle() {
      const who = connected && profile ? asText(profile.name) : "";
      document.title = buildAppTitle(who);
    }
    function updateUserUi() {
      if (connected && profile && profile.name) ui.userMenuToggle.textContent = profile.name;
      else if (manuallyDisconnected) ui.userMenuToggle.textContent = "Disconnected";
      else ui.userMenuToggle.textContent = "Guest";
      element("menu-connect", "button").style.display = connected ? "none" : "block";
      element("menu-settings", "button").style.display = connected ? "block" : "none";
      element("menu-export", "button").style.display = connected ? "block" : "none";
      if (ui.menuSummary) ui.menuSummary.style.display = connected ? "block" : "none";
      element("menu-logout", "button").style.display = connected ? "block" : "none";
      setTitle();
      updateSummaryReminderUi();
    }
    function parseCriteriaTokens(raw: unknown) { const t = asText(raw).toLowerCase(); const m = t.match(/(x|ix|viii|vii|vi|iv|v|iii|ii|i)/g) || []; const out = []; const seen = new Set<string>(); for (const k of m) if (!seen.has(k)) { seen.add(k); out.push(k); } return out; }
    function criteriaHtml(raw: unknown) { const tokens = parseCriteriaTokens(raw); if (!tokens.length) return "n/a"; return tokens.map(t => `<a href="${CRITERIA_URL}" target="_blank" rel="noopener" title="${asText(criteriaTitles[t] || "UNESCO criterion")}">(${t})</a>`).join(" "); }
    function getVisitStatus(siteId: string) {
      if (!(connected && profile)) return "not_visited";
      const latest = getLatestVisitEntry(siteId);
      return latest ? (asText(latest.status) || "not_visited") : "not_visited";
    }
    const isVisited = (siteId: string) => getVisitStatus(siteId) === "visited";
    function getMultipleThreshold() {
      const n = Number(connected && profile && profile.settings && profile.settings.multipleThreshold);
      if (!Number.isFinite(n) || n < 1) return 5;
      return Math.floor(n);
    }
    function rebuildComponentIndexes() {
      componentCountByRootId = new Map();
      highVolumeComponentSiteIds = new Set<string>();
      if (!whsData || !Array.isArray(whsData.features)) return;
      for (const f of whsData.features) {
        const p = f.properties || {};
        const scope = asText(p.site_scope);
        const siteId = asText(p.site_id);
        if (scope === "whs") {
          const count = Number(p.component_count);
          if (siteId && Number.isFinite(count) && count > 0) componentCountByRootId.set(siteId, count);
        }
      }
      const threshold = getMultipleThreshold();
      for (const f of whsData.features) {
        const p = f.properties || {};
        if (asText(p.site_scope) !== "component") continue;
        const siteId = asText(p.site_id);
        const parentId = asText(p.parent_site_id);
        const parentCount = Number(componentCountByRootId.get(parentId) || 0);
        if (siteId && parentCount > threshold) highVolumeComponentSiteIds.add(siteId);
      }
    }
    function isHighVolumeComponent(siteId: string) {
      return highVolumeComponentSiteIds.has(asText(siteId));
    }
    function shouldShowSite(siteId: string) {
      if (siteId === temporarilyVisibleSiteId) return true;
      const onlyVisited = !!(connected && profile && profile.settings && profile.settings.visitedOnly);
      const visited = isVisited(siteId);
      if (onlyVisited && !visited) return false;
      if (!isHighVolumeComponent(siteId)) return true;
      if (visited) return true;
      if (explicitVisibleSiteIds.has(siteId)) return true;
      if ((lastSearchedSiteIds || []).includes(siteId)) return true;
      if (selectedSiteId === siteId) return true;
      return false;
    }
    const markerStyle = (siteId: string) => {
      const s = getVisitStatus(siteId);
      if (s === "visited") return { radius: 5, color: "#0d6b43", weight: 1, fillColor: "#1f8a55", fillOpacity: 0.85 };
      if (s === "pending") return { radius: 5, color: "#9a6a00", weight: 1, fillColor: "#d69c00", fillOpacity: 0.85 };
      if (s === "wont_visit") return { radius: 5, color: "#666", weight: 1, fillColor: "#999", fillOpacity: 0.75 };
      return { radius: 5, color: "#0a4f8a", weight: 1, fillColor: "#1f77b4", fillOpacity: 0.85 };
    };
    function clearSelection() {
      selectedSiteId = null;
      ui.detailPane.style.display = "none";
      ui.detailPane.innerHTML = "";
      const mode = asText(ui.siteListMode.value);
      const shouldRestoreList = (selectionContext === "list") || (selectionContext === "search") || mode === "searched" || mode === "visited" || mode === "all" || mode === "multiple";
      if (shouldRestoreList) renderSiteList(mode);
      selectionContext = "";
    }
    function latestVisitDate(siteId: string) {
      const v = getSiteVisits(siteId);
      return v.length ? normalizeDateOnly(v[0].date) : "";
    }
    function renderSiteList(mode: string) {
      if (!whsData || !Array.isArray(whsData.features)) return;
      if (!mode) {
        selectedSiteId = null;
        ui.detailPane.style.display = "none";
        ui.detailPane.innerHTML = "";
        return;
      }
      let features = [];
      if (mode === "visited") {
        const ids = new Set<string>();
        if (connected && profile) {
          for (const k of Object.keys(profile.siteVisits || {})) {
            if (getVisitStatus(k) === "visited") ids.add(k);
          }
        }
        features = whsData.features.filter((f) => ids.has(asText(f.properties && f.properties.site_id)));
      } else if (mode === "multiple") {
        features = whsData.features.filter((f) => isHighVolumeComponent(asText(f.properties && f.properties.site_id)));
      } else if (mode === "searched") {
        const ids = new Set(lastSearchedSiteIds || []);
        features = whsData.features.filter((f) => ids.has(asText(f.properties && f.properties.site_id)));
      } else {
        features = whsData.features.filter((f) => !isHighVolumeComponent(asText(f.properties && f.properties.site_id))).slice(0, 1000);
      }
      features.sort((a, b) => {
        const pa = a.properties || {};
        const pb = b.properties || {};
        const na = displayName(pa).toLowerCase();
        const nb = displayName(pb).toLowerCase();
        const da = dateSortKey(latestVisitDate(asText(pa.site_id)));
        const db = dateSortKey(latestVisitDate(asText(pb.site_id)));
        if (listSortBy === "date") {
          if (listSortDir === "desc") return (db || "0000-00-00").localeCompare(da || "0000-00-00") || na.localeCompare(nb);
          return (da || "9999-99-99").localeCompare(db || "9999-99-99") || na.localeCompare(nb);
        }
        if (listSortDir === "desc") return nb.localeCompare(na);
        return na.localeCompare(nb);
      });
      ui.detailPane.style.display = "block";
      if (!features.length) {
        ui.detailPane.innerHTML = `<div class="site-table-head"><span>Site</span><span>Visited</span></div><p class="meta">No sites in this list.</p>`;
        return;
      }
      const rows = features.map((f) => {
        const p = f.properties || {};
        const sid = asText(p.site_id);
        const nm = displayName(p);
        const d = formatVisitDateForDisplay(latestVisitDate(sid));
        return `<div class="site-row-grid"><a href="#" class="plain-link site-pick" data-site-id="${sid}" dir="auto" title="${nm}"><span class="site-name-clip">${nm}</span></a><span class="meta" dir="ltr">${d || ""}</span></div>`;
      }).join("");
      const nameDir = listSortBy === "name" ? (listSortDir === "asc" ? "^" : "v") : "";
      const dateDir = listSortBy === "date" ? (listSortDir === "asc" ? "^" : "v") : "";
      ui.detailPane.innerHTML = `<div class="site-list-wrap"><div class="site-table-head"><a href="#" id="sort-name">Site (${features.length}) ${nameDir}</a><a href="#" id="sort-date">Visited ${dateDir}</a></div>${rows}</div>`;
      const sortName = element("sort-name", "a");
      const sortDate = element("sort-date", "a");
      if (sortName) sortName.addEventListener("click", (e) => { e.preventDefault(); if (listSortBy === "name") listSortDir = listSortDir === "asc" ? "desc" : "asc"; else { listSortBy = "name"; listSortDir = "asc"; } renderSiteList(mode); });
      if (sortDate) sortDate.addEventListener("click", (e) => { e.preventDefault(); if (listSortBy === "date") listSortDir = listSortDir === "asc" ? "desc" : "asc"; else { listSortBy = "date"; listSortDir = "desc"; } renderSiteList(mode); });
      ui.detailPane.querySelectorAll(".site-pick").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const id = asText(btn.getAttribute("data-site-id"));
          explicitVisibleSiteIds.add(id);
          selectionContext = "list";
          zoomToSite(id);
        });
      });
    }
    async function copySnapshot() {
      if (typeof html2canvas !== "function") return alert("Snapshot image capture is unavailable in this browser.");
      showLoading("Capturing snapshot...");
      try {
        const canvas = await html2canvas(element("map", "div"), { useCORS: true, backgroundColor: "#ffffff", logging: false });
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Snapshot image encoding failed.")), "image/png");
        });
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            alert("Snapshot image copied.");
            return;
          } catch {}
        }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `my-world-heritage-snapshot-${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
        alert("Snapshot image downloaded.");
      } catch {
        alert("Snapshot image failed.");
      } finally {
        hideLoading();
      }
    }
    function featureBySiteId(siteId: string): Site | null {
      const wanted = asText(siteId).trim();
      if (!wanted) return null;
      const marker = markersBySiteId.get(wanted);
      if (marker && marker.feature) return marker.feature;
      return findFeatureBySiteId(wanted);
    }
    function collectVisitedReportRows(): ReportRow[] {
      if (!(connected && profile)) return [];
      const rows = [];
      const seen = new Set<string>();
      const candidateIds = new Set(Object.keys(profile.siteVisits || {}));
      for (const siteId of candidateIds) {
        if (getVisitStatus(siteId) !== "visited") continue;
        const feature = featureBySiteId(siteId);
        if (!feature) continue;
        const p = feature.properties || {};
        const id = asText(p.site_id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const latest = latestVisitDate(id);
        rows.push({
          siteId: id,
          name: displayName(p),
          country: asText(p.country),
          status: formatStatusLabel(getVisitStatus(id)),
          latestVisitRaw: latest,
          latestVisitDisplay: formatVisitDateForReport(latest),
          feature
        });
      }
      rows.sort((a, b) => asText(a.name).localeCompare(asText(b.name)));
      return rows;
    }
    function formatReportSiteId(siteId: string) {
      return assertValidSiteId(siteId, "report site id");
    }
    function reportSiteIdHtml(siteId: string) {
      return escapeHtml(formatReportSiteId(siteId)).replace(/ /g, "\u00A0").replace(/-/g, "\u2011");
    }
    function plotVisitedPointsOnProjection(ctx: CanvasRenderingContext2D, rows: ReportRow[], box: {x:number; y:number; w:number; h:number}) {
      for (const row of rows) {
        const f = row.feature;
        if (!(f && f.geometry && Array.isArray(f.geometry.coordinates))) continue;
        const lon = Number(f.geometry.coordinates[0]);
        const lat = Number(f.geometry.coordinates[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const x = box.x + ((lon + 180) / 360) * box.w;
        const y = box.y + ((90 - lat) / 180) * box.h;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#d62d20";
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }
    function renderFallbackSummaryMap(rows: ReportRow[], width = 1200, height = 520) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas rendering unavailable");
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, "#f6f8fb");
      bg.addColorStop(1, "#e8edf3");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);
      const mapRect = { x: width * 0.03, y: height * 0.08, w: width * 0.94, h: height * 0.84 };
      const ocean = ctx.createLinearGradient(0, mapRect.y, 0, mapRect.y + mapRect.h);
      ocean.addColorStop(0, "#86b0ca");
      ocean.addColorStop(0.45, "#91b694");
      ocean.addColorStop(1, "#c7d3df");
      ctx.fillStyle = ocean;
      ctx.fillRect(mapRect.x, mapRect.y, mapRect.w, mapRect.h);
      const toXY = (lon: number, lat: number) => ([
        mapRect.x + ((lon + 180) / 360) * mapRect.w,
        mapRect.y + ((90 - lat) / 180) * mapRect.h
      ]);
      const drawLand = (points: number[][], fill = "#c8c9ad") => {
        if (!Array.isArray(points) || points.length < 3) return;
        ctx.beginPath();
        points.forEach((pt, i) => {
          const [x, y] = toXY(pt[0], pt[1]);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = "rgba(83, 97, 89, 0.45)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      };
      const landPolys = [
        [[-169, 72], [-140, 72], [-125, 66], [-105, 56], [-98, 50], [-90, 44], [-82, 27], [-100, 16], [-111, 19], [-120, 26], [-135, 41], [-150, 57], [-165, 65]],
        [[-82, 12], [-72, 7], [-66, -4], [-59, -16], [-54, -31], [-57, -45], [-66, -55], [-74, -49], [-80, -33], [-82, -17], [-84, -2]],
        [[-11, 34], [5, 37], [18, 32], [32, 30], [43, 18], [49, 6], [45, -10], [36, -24], [18, -35], [2, -34], [-8, -20], [-11, -2], [-12, 18]],
        [[-9, 36], [12, 44], [32, 52], [58, 58], [85, 63], [115, 56], [142, 49], [156, 44], [160, 31], [141, 17], [120, 10], [104, 6], [90, 10], [70, 21], [50, 25], [32, 25], [20, 34], [6, 44], [-5, 43]],
        [[112, -12], [126, -12], [142, -19], [153, -28], [146, -40], [130, -41], [116, -34], [111, -23]],
        [[-52, 60], [-39, 61], [-28, 72], [-39, 82], [-55, 80], [-63, 70]],
        [[46, -12], [50, -16], [48, -24], [42, -23], [41, -17]]
      ];
      for (const poly of landPolys) drawLand(poly);
      ctx.strokeStyle = "rgba(255,255,255,0.16)";
      ctx.lineWidth = 0.75;
      for (let lon = -150; lon <= 150; lon += 30) {
        const x = mapRect.x + ((lon + 180) / 360) * mapRect.w;
        ctx.beginPath();
        ctx.moveTo(x, mapRect.y);
        ctx.lineTo(x, mapRect.y + mapRect.h);
        ctx.stroke();
      }
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = mapRect.y + ((90 - lat) / 180) * mapRect.h;
        ctx.beginPath();
        ctx.moveTo(mapRect.x, y);
        ctx.lineTo(mapRect.x + mapRect.w, y);
        ctx.stroke();
      }
      plotVisitedPointsOnProjection(ctx, rows, mapRect);
      return { dataUrl: canvas.toDataURL("image/png"), mode: "fallback" };
    }
    function waitForTileLayerLoad(tileLayer: L.TileLayer, timeoutMs = 18000) {
      return new Promise<{timedOut: boolean; errorCount: number}>((resolve) => {
        let done = false;
        let timedOut = false;
        let errorCount = 0;
        const finish = () => {
          if (done) return;
          done = true;
          try { tileLayer.off("load", onLoad); } catch {}
          try { tileLayer.off("tileerror", onTileError); } catch {}
          resolve({ timedOut, errorCount });
        };
        const onLoad = () => finish();
        const onTileError = () => { errorCount += 1; };
        try { tileLayer.on("load", onLoad); } catch {}
        try { tileLayer.on("tileerror", onTileError); } catch {}
        setTimeout(() => {
          timedOut = true;
          finish();
        }, timeoutMs);
      });
    }
    async function waitForRenderedTiles(host: HTMLElement, tileLayer: L.TileLayer, timeoutMs = 18000) {
      const start = Date.now();
      return new Promise<void>((resolve, reject) => {
        const step = () => {
          const timedOut = (Date.now() - start) > timeoutMs;
          const tiles = Array.from(host.querySelectorAll(".leaflet-tile"));
          const allReady = tiles.length > 0 && tiles.every((t) => t instanceof HTMLImageElement && t.complete && t.naturalWidth > 0 && t.naturalHeight > 0);
          const loading = tileLayer && typeof tileLayer.isLoading === "function" && tileLayer.isLoading();
          const hasLoadingClass = !!host.querySelector(".leaflet-tile-loading");
          if (allReady && !loading && !hasLoadingClass) {
            resolve();
            return;
          }
          if (timedOut) {
            reject(new Error("Timed out waiting for full tile render."));
            return;
          }
          requestAnimationFrame(step);
        };
        step();
      });
    }
    function applyReportMapView(tmpMap: L.Map, rows: ReportRow[]) {
      tmpMap.setView([18, 0], 3, { animate: false });
      for (const row of rows) {
        const f = row && row.feature;
        if (!(f && f.geometry && Array.isArray(f.geometry.coordinates))) continue;
        const lon = Number(f.geometry.coordinates[0]);
        const lat = Number(f.geometry.coordinates[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        L.circleMarker([lat, lon], {
          radius: 5,
          color: "#ffffff",
          weight: 1.2,
          fillColor: "#d62d20",
          fillOpacity: 0.95
        }).addTo(tmpMap);
      }
    }
    function createReportRenderHost(width: number, height: number) {
      const host = document.createElement("div");
      host.style.position = "fixed";
      host.style.left = "0";
      host.style.top = "0";
      host.style.width = `${width}px`;
      host.style.height = `${height}px`;
      host.style.pointerEvents = "none";
      host.style.zIndex = "-1";
      host.style.background = "#eef2f7";
      document.body.appendChild(host);
      return host;
    }
    async function captureReportMap(width: number, height: number, rows: ReportRow[]) {
      const host = createReportRenderHost(width, height);
      let tmpMap: L.Map | null = null;
      try {
        tmpMap = L.map(host, {
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
          worldCopyJump: false,
          fadeAnimation: false,
          zoomAnimation: false,
          markerZoomAnimation: false,
          inertia: false
        }).setView([18, 0], 3);
        tmpMap.invalidateSize(true);
        const tileLayer = L.tileLayer(REPORT_TILE_URL, {
          minZoom: 1,
          maxZoom: 8,
          crossOrigin: "anonymous",
          keepBuffer: 2,
          updateWhenIdle: true,
          noWrap: true
        }).addTo(tmpMap);
        applyReportMapView(tmpMap, rows);
        const layerState = await waitForTileLayerLoad(tileLayer);
        if (layerState.timedOut || layerState.errorCount > 0) throw new Error("Tile source returned incomplete tiles.");
        await waitForRenderedTiles(host, tileLayer);
        await new Promise((r) => setTimeout(r, 700));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const canvas = await html2canvas(host, {
          useCORS: true,
          backgroundColor: "#eef2f7",
          logging: false,
          scale: 1
        });
        return canvas.toDataURL("image/png");
      } finally {
        try { if (tmpMap) tmpMap.remove(); } catch {}
        host.remove();
      }
    }
    async function renderTileSummaryMap(rows: ReportRow[], width = 2048, height = 960) {
      if (typeof html2canvas !== "function") throw new Error("html2canvas unavailable.");
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const hiResDataUrl = await captureReportMap(width, height, rows);
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const x = new Image();
            x.onload = () => resolve(x);
            x.onerror = () => reject(new Error("Failed to decode rendered map image."));
            x.src = hiResDataUrl;
          });
          const out = document.createElement("canvas");
          out.width = width;
          out.height = height;
          const outCtx = out.getContext("2d");
          if (!outCtx) throw new Error("Canvas rendering unavailable");
          outCtx.drawImage(img, 0, 0, width, height);
          return { dataUrl: out.toDataURL("image/png"), mode: "tile" };
        } catch {
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 500 * attempt));
            continue;
          }
        }
      }
      throw new Error("No tile source could be captured.");
    }
    async function renderVisitedSummaryMap(rows: ReportRow[]) {
      try {
        return await renderTileSummaryMap(rows);
      } catch {
        return renderFallbackSummaryMap(rows);
      }
    }
    async function exportVisitedSummaryReport() {
      if (!(connected && profile)) return alert("Connect first.");
      const rows = collectVisitedReportRows();
      showLoading("Preparing summary report...");
      try {
        const mapImage = await renderVisitedSummaryMap(rows);
        const now = new Date();
        const generatedAtLocal = formatTimestampLocal(now);
        const generatedAtLocalHtml = nbspHtml(generatedAtLocal);
        const reportUserName = asText(profile.name || "user");
        const reportTitle = buildAppTitle(reportUserName);
        const reportTitleHtml = escapeHtml(reportTitle);
        const reportLogoDataUrl = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 128 128\" role=\"img\" aria-label=\"My World Heritage mark\"><path d=\"M12 36 L64 10 L116 36 Z\" fill=\"#0a4f8a\"/><rect x=\"20\" y=\"44\" width=\"14\" height=\"52\" fill=\"#0a4f8a\"/><rect x=\"57\" y=\"44\" width=\"14\" height=\"52\" fill=\"#0a4f8a\"/><rect x=\"94\" y=\"44\" width=\"14\" height=\"52\" fill=\"#0a4f8a\"/><rect x=\"12\" y=\"102\" width=\"104\" height=\"12\" fill=\"#0a4f8a\"/></svg>');
        const tableRows = rows.map((r) => {
          const url = asText(r.feature && r.feature.properties && r.feature.properties.unesco_url);
          const siteNameHtml = url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(r.name)}</a>` : escapeHtml(r.name);
          return `<tr><td class="site-id">${reportSiteIdHtml(r.siteId)}</td><td>${siteNameHtml}</td><td class="visited-date">${nbspHtml(r.latestVisitDisplay || "")}</td><td>${escapeHtml(r.status)}</td><td class="country">${escapeHtml(r.country)}</td></tr>`;
        }).join("");
        const appUrl = "https://pekka-28.github.io/unesco/site/";
        const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${reportTitleHtml}</title>
<style>
body{font:14px/1.4 sans-serif;margin:18px;color:#1f2b38;background:#f6f8fb}
h1{margin:0}
.meta{color:#45566b;margin:0}
.head-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin:0 0 12px 0}
.head-left{display:flex;align-items:flex-end;gap:12px}
.head-left h1{margin:0 0 4px 0}
.report-logo{width:62px;height:76px;display:block;flex:0 0 auto;object-fit:contain;object-position:center bottom;border:0 !important;background:transparent !important;box-shadow:none !important;border-radius:0}
.head-meta{text-align:right}
.card{background:#fff;border:1px solid #c9d4df;border-radius:10px;padding:12px;margin-bottom:14px}
img{width:100%;height:auto;border:1px solid #c9d4df;border-radius:8px;background:#eef2f7;display:block}
table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto;border:1px solid #d7e0e8}
th,td{border:0;padding:6px 8px;text-align:left;vertical-align:top}
th{background:transparent}
.site-id{white-space:nowrap;width:1%}
.visited-date{text-align:right;white-space:nowrap}
.country{max-width:25em;white-space:normal;overflow-wrap:anywhere;word-break:break-word}
a{color:#0a4f8a;text-decoration:none} a:hover{text-decoration:underline}
</style></head><body>
<div class="head-row">
<div class="head-left"><img class="report-logo" alt="My World Heritage symbol" src="${reportLogoDataUrl}"><h1>${reportTitleHtml}</h1></div>
<p class="meta head-meta">${generatedAtLocalHtml} Visited sites ${rows.length} <a href="${appUrl}" target="_blank" rel="noopener">${escapeHtml(APP_NAME)}</a> <a href="${appUrl}" target="_blank" rel="noopener">(${appUrl})</a></p>
</div>
<div style="margin:0 0 14px 0;">
<img alt="Visited sites world map" src="${mapImage.dataUrl}">
</div>
<div class="card">
<h2 style="margin-top:0;">Visited sites</h2>
<table><colgroup><col style="width:1%"><col><col style="width:11ch"><col style="width:12ch"><col style="width:25em"></colgroup><thead><tr><th class="site-id">Site</th><th>Name</th><th class="visited-date">Visited</th><th>Status</th><th>Country</th></tr></thead><tbody>${tableRows || '<tr><td colspan="5">No visited sites recorded.</td></tr>'}</tbody></table>
</div>
<div class="card">
<h3 style="margin-top:0;">Table columns</h3>
<p class="meta"><strong>Site</strong>: unique site identifier used by the application. <strong>WHS</strong> is the UNESCO site code; <strong>MWH</strong> is a My World Heritage identifier added to disambiguate sub-site identification.</p>
<p class="meta"><strong>Name</strong>: site name, linked to UNESCO narrative page when available.</p>
<p class="meta"><strong>Visited</strong>: most recent recorded visit date for the site.</p>
<p class="meta"><strong>Status</strong>: latest visit status recorded for the site.</p>
<p class="meta"><strong>Country</strong>: jurisdiction list provided by the dataset for the site.</p>
</div>
</body></html>`;
        const blob = new Blob([html], { type: "text/html" });
        const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}`;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `my-world-heritage-summary-${stamp}.html`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(a.href);
      } catch (e) {
        alert("Summary report failed: " + asText(e && errorMessage(e)));
      } finally {
        hideLoading();
      }
    }
    function renderDetail(feature: Site) {
      const p = feature.properties || {}; const siteId = asText(p.site_id); const name = displayName(p); const status = getVisitStatus(siteId); selectedSiteId = siteId;
      const nativeName = detectNativeScriptName(p, name);
      if (connected && profile && !profile.inspectedSiteIds.includes(siteId)) { profile.inspectedSiteIds.push(siteId); profile.usage.inspectCount = Number(profile.usage.inspectCount || 0) + 1; persistProfile(); }
      const inscription = asText(p.inscription_date);
      const note = asText(p.note || p.description);
      const wiki = asText(p.wikipedia);
      const wikiUrl = wiki && wiki.includes(":") ? `https://${wiki.replace(":", ".wikipedia.org/wiki/")}` : "";
      const infoLines = [`<strong>Catalogue status:</strong> ${p.status === "retired" ? "Retired" : "Active"}`];
      if (p.status === "retired") infoLines.push("Not matched in the latest source; retained for recording visits.");
      if (inscription) infoLines.push(`<strong>Inscription date:</strong> ${inscription}`);
      const scope = asText(p.site_scope);
      if (scope === "whs") {
        const componentCount = Number(p.component_count || 0);
        if (componentCount > 1) infoLines.push(`<strong>Multiple individual sites:</strong> yes (${componentCount})`);
      } else if (scope === "component") {
        const parentId = asText(p.parent_site_id);
        const parentCount = Number(componentCountByRootId.get(parentId) || 0);
        if (parentId) {
          if (parentCount > 0) infoLines.push(`<strong>Component of ${parentId}:</strong> ${parentCount} individual sites`);
          else infoLines.push(`<strong>Component of:</strong> ${parentId}`);
        }
      }
      if (wikiUrl) infoLines.push(`<strong>Wikipedia:</strong> <a href="${wikiUrl}" target="_blank" rel="noopener">${wiki}</a>`);
      if (note) infoLines.push(`<strong>Notes:</strong> ${note}`);
      const visits = getSiteVisits(siteId);
      const visitRows = visits.length ? visits.map((v) => {
        const d = formatVisitDateForDisplay(v.date) || "No date";
        const s = formatStatusLabel(asText(v.status) || "not_visited");
        const nFull = asText(v.note).trim();
        const n = truncateText(nFull, 72);
        return `<div class="visited-row" data-visit-id="${asText(v.id)}" style="display:flex; justify-content:space-between; gap:8px;"><div><span>${d}</span> <span class="meta">${s}</span>${n ? ` <span class="meta visit-note-clip" title="${nFull}">${n}</span>` : ""}</div><div><a href="#" class="plain-link visit-edit" title="Edit visit" data-visit-id="${asText(v.id)}">&#9998;</a> <a href="#" class="plain-link visit-delete" title="Delete visit" data-visit-id="${asText(v.id)}">&#128465;</a></div></div>`;
      }).join("") : '<div class="meta">No recorded visits for this site.</div>';
      ui.detailPane.style.display = "block";
      ui.detailPane.innerHTML = `<h3 style="margin:0 0 6px 0;"><a href="${asText(p.unesco_url)}" target="_blank" rel="noopener">${name}</a></h3>${nativeName ? `<div dir="auto" style="margin:0 0 6px 0;">${nativeName}</div>` : ""}<div class="muted">${siteIdCaption(feature)}</div><p><strong>Criteria:</strong> ${criteriaHtml(p.whc_criteria)}</p>${infoLines.length ? `<p>${infoLines.join("<br>")}</p>` : ""}<hr><h4 style="margin:10px 0 6px 0;">Visit log</h4><div id="visit-log-list">${visitRows}</div><div class="row" style="margin-top:8px;"><input id="visit-date" class="field" type="text" placeholder="YYYY-MM-DD, YYYY-MM, or YYYY"></div><div class="row"><select id="visit-entry-status" class="field"><option value="visited">Visited</option><option value="pending">Pending</option><option value="wont_visit">Won't visit</option><option value="not_visited">Not visited</option></select></div><div class="row"><textarea id="visit-note" class="field" rows="3" placeholder="Note"></textarea></div><div class="row" style="display:flex; gap:8px;"><button id="visit-save" class="btn primary" type="button">Save</button><button id="visit-cancel-edit" class="btn" type="button" style="display:none;">Cancel</button></div>`;
      const visitDate = element("visit-date", "input");
      const visitEntryStatus = element("visit-entry-status", "select");
      const visitNote = element("visit-note", "textarea");
      const visitSave = element("visit-save", "button");
      const visitCancel = element("visit-cancel-edit", "button");
      let editingVisitId = "";
      visitEntryStatus.value = status === "not_visited" ? "visited" : status;
      visitDate.value = defaultVisitDateValue();
      function resetVisitEditor() {
        editingVisitId = "";
        visitDate.value = defaultVisitDateValue();
        visitEntryStatus.value = status === "not_visited" ? "visited" : status;
        visitNote.value = "";
        visitCancel.style.display = "none";
      }
      visitSave.addEventListener("click", () => {
        if (!(connected && profile)) return alert("Connect first.");
        const d = normalizeDateOnly(visitDate.value);
        if (!d) return alert("Please provide a visit date.");
        saveSiteVisit(siteId, { id: editingVisitId, date: d, status: visitEntryStatus.value, note: visitNote.value });
        refreshMarkers();
        renderDetail(feature);
      });
      visitCancel.addEventListener("click", () => { resetVisitEditor(); });
      visitDate.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); visitSave.click(); } });
      visitNote.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        if (e.shiftKey) return;
        e.preventDefault();
        visitSave.click();
      });
      ui.detailPane.querySelectorAll(".visit-edit").forEach((a) => {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          const vid = asText(a.getAttribute("data-visit-id"));
          const item = visits.find((v) => asText(v.id) === vid);
          if (!item) return;
          editingVisitId = vid;
          visitDate.value = normalizeDateOnly(item.date);
          visitEntryStatus.value = asText(item.status) || "visited";
          visitNote.value = asText(item.note);
          visitCancel.style.display = "inline-block";
        });
      });
      ui.detailPane.querySelectorAll(".visit-delete").forEach((a) => {
        a.addEventListener("click", (e) => {
          e.preventDefault();
          const vid = asText(a.getAttribute("data-visit-id"));
          deleteSiteVisit(siteId, vid);
          refreshMarkers();
          renderDetail(feature);
        });
      });
    }
    let temporarilyVisibleSiteId: string | null = null;
    function refreshMarkers(revealSiteId: string | null = null) {
      // A selection survives its own zoom; the next ordinary redraw restores filters.
      temporarilyVisibleSiteId = revealSiteId;
      for (const [siteId, marker] of markersBySiteId.entries()) marker.setStyle(markerStyle(siteId));
      applyVisitedOnlyFilter();
    }
    function applyVisitedOnlyFilter() {
      if (!layer) return;
      layer.eachLayer(marker => {
        const siteId = marker instanceof L.CircleMarker ? asText(marker.feature?.properties.site_id) : "";
        const show = shouldShowSite(siteId);
        if (show) {
          if (!map.hasLayer(marker)) marker.addTo(map);
        } else {
          if (map.hasLayer(marker)) map.removeLayer(marker);
        }
      });
    }
    function zoomToSite(siteId: string) {
      const marker = markersBySiteId.get(siteId);
      if (!marker) return;
      explicitVisibleSiteIds.add(asText(siteId));
      refreshMarkers(asText(siteId));
      const focus = searchFocusBySiteId.get(asText(siteId));
      if (focus && Number.isFinite(focus.lat) && Number.isFinite(focus.lon)) map.setView([focus.lat, focus.lon], 12);
      else {
        const ll = marker.getLatLng();
        map.setView([ll.lat, ll.lng], 12);
      }
      if (marker.feature) renderDetail(marker.feature);
    }
    function canonicalPlaceName(display: unknown) {
      return asText(display).split(",")[0].trim();
    }
    function compactPlaceLabel(display: unknown) {
      const raw = asText(display);
      const canonical = canonicalPlaceName(raw);
      const bits = raw.split(",").map((s) => s.trim()).filter(Boolean);
      const tail = bits.length ? bits[bits.length - 1] : "";
      if (!tail || tail.toLowerCase() === canonical.toLowerCase()) return canonical;
      return `${canonical} (${tail})`;
    }
    function buildLocationMatchIndex(matches: LocationMatch[], indexByLabel: Map<string, number>) {
      indexByLabel.clear();
      if (!matches.length) return [];
      const used = new Set<string>();
      const labels = [];
      for (let i = 0; i < matches.length; i++) {
        const r = matches[i];
        const base = compactPlaceLabel(r.display_name) || `Match ${i + 1}`;
        let label = base;
        let n = 2;
        while (used.has(label.toLowerCase())) {
          label = `${base} [${n}]`;
          n += 1;
        }
        used.add(label.toLowerCase());
        indexByLabel.set(label.toLowerCase(), i);
        labels.push(label);
      }
      return labels;
    }
    function renderLocationMatches(listEl: HTMLElement, matches: LocationMatch[], indexByLabel: Map<string, number>) {
      listEl.innerHTML = "";
      const labels = buildLocationMatchIndex(matches, indexByLabel);
      if (!labels.length) return;
      for (const label of labels) {
        const opt = document.createElement("option");
        opt.value = label;
        listEl.appendChild(opt);
      }
    }
    function renderEnrolLocationSuggestions(containerEl: HTMLElement, matches: LocationMatch[], indexByLabel: Map<string, number>) {
      if (!containerEl) return;
      const labels = buildLocationMatchIndex(matches, indexByLabel);
      if (!labels.length) {
        containerEl.style.display = "none";
        containerEl.innerHTML = "";
        return;
      }
      containerEl.style.display = "block";
      containerEl.innerHTML = labels.map((label, i) => `<div class="combo-row" data-match-index="${i}">${escapeHtml(label)}</div>`).join("");
    }
    function resolveLocationMatchFromInput(inputValue: string, matches: LocationMatch[], indexByLabel: Map<string, number>) {
      const key = asText(inputValue).trim().toLowerCase();
      if (!key) return null;
      const idx = indexByLabel.get(key);
      if (idx !== undefined && matches[idx]) return matches[idx];
      if (matches.length === 1) {
        const one = matches[0];
        const canon = canonicalPlaceName(one.display_name).toLowerCase();
        if (canon === key) return one;
      }
      return null;
    }
    function setSelectedHome(lat: number, lon: number, label: string, updateInput = true) {
      selectedHome = { lat, lon, label };
      if (updateInput) ui.homeQuery.value = label;
      ui.homeSelected.textContent = `Selected home location: ${label}`;
      map.setView([lat, lon], 6);
    }
    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    function getNearbySites(lat: number, lon: number, maxKm = 500) {
      if (!whsData || !Array.isArray(whsData.features)) return [];
      const rows = [];
      for (const f of whsData.features) {
        if (!f.geometry || f.geometry.type !== "Point") continue;
        const flon = Number(f.geometry.coordinates[0]);
        const flat = Number(f.geometry.coordinates[1]);
        if (!Number.isFinite(flat) || !Number.isFinite(flon)) continue;
        const d = haversineKm(lat, lon, flat, flon);
        if (d <= maxKm) rows.push({ feature: f, distanceKm: d });
      }
      rows.sort((a, b) => a.distanceKm - b.distanceKm);
      return rows;
    }
    function renderEnrolNearby(lat: number, lon: number) {
      const near = getNearbySites(lat, lon, 500).slice(0, 10);
      if (!near.length) {
        ui.enrolNearbyList.innerHTML = '<div class="meta">No nearby sites found.</div>';
        return;
      }
      ui.enrolNearbyList.innerHTML = '<ol style="margin:0; padding-left:20px;"></ol>';
      const list = ui.enrolNearbyList.querySelector("ol");
      for (const row of near) {
        const p = row.feature.properties || {};
        const id = asText(p.site_id);
        const name = displayName(p);
        const li = document.createElement("li");
        li.className = "visited-row";
        li.innerHTML = `<label><input type="checkbox" data-site-id="${id}"> <span dir="auto">${escapeHtml(name)}</span></label>`;
        list?.appendChild(li);
      }
    }
    function setEnrolHome(lat: number, lon: number, label: string, updateInput = true) {
      enrolSelectedHome = { lat, lon, label };
      if (updateInput) ui.enrolHomeQuery.value = label;
      ui.enrolHomeSelected.textContent = `Selected home location: ${label}`;
    }
    function applyHomeSelectionFromInput() {
      const picked = resolveLocationMatchFromInput(ui.homeQuery.value, homeMatches, homeMatchIndexByLabel);
      if (!picked) return false;
      setSelectedHome(Number(picked.lat), Number(picked.lon), canonicalPlaceName(picked.display_name));
      ui.locStatus.textContent = "Location selected.";
      return true;
    }
    function applyEnrolSelectionFromInput() {
      const picked = resolveLocationMatchFromInput(ui.enrolHomeQuery.value, enrolMatches, enrolMatchIndexByLabel);
      if (!picked) return false;
      setEnrolHome(Number(picked.lat), Number(picked.lon), canonicalPlaceName(picked.display_name));
      ui.enrolLocStatus.textContent = "Location selected. Nearby sites listed.";
      renderEnrolNearby(Number(picked.lat), Number(picked.lon));
      return true;
    }
    async function searchHomeLocation() {
      const q = asText(ui.homeQuery.value).trim();
      if (!q) { ui.locStatus.textContent = "Enter a location to search."; return; }

      if (applyHomeSelectionFromInput()) return;

      ui.locStatus.textContent = "Searching...";
      ui.homeMatchesList.innerHTML = "";
      homeMatchIndexByLabel.clear();
      homeMatches = [];

      try {
        showLoading("Loading ...");
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(q)}`);
        if (!res.ok) return ui.locStatus.textContent = "Search failed.";
        const results: LocationMatch[] = await res.json();
        if (!Array.isArray(results) || !results.length) return ui.locStatus.textContent = "No location matches found.";

        homeMatches = results;
        renderLocationMatches(ui.homeMatchesList, results, homeMatchIndexByLabel);
        if (results.length === 1) {
          setSelectedHome(Number(results[0].lat), Number(results[0].lon), canonicalPlaceName(results[0].display_name));
          ui.locStatus.textContent = "Unique match found.";
          return;
        }
        ui.locStatus.textContent = "Select one suggestion in the search field, then press Search.";
      } catch (e) {
        ui.locStatus.textContent = "Search failed: " + errorMessage(e);
      } finally {
        hideLoading();
      }
    }
    async function searchEnrolHomeLocation() {
      const q = asText(ui.enrolHomeQuery.value).trim();
      if (!q) { ui.enrolLocStatus.textContent = "Enter a location to search."; return; }

      if (applyEnrolSelectionFromInput()) return;

      ui.enrolLocStatus.textContent = "Searching...";
      renderEnrolLocationSuggestions(ui.enrolHomeSuggestions, [], enrolMatchIndexByLabel);
      enrolMatches = [];

      try {
        showLoading("Loading ...");
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(q)}`);
        if (!res.ok) return ui.enrolLocStatus.textContent = "Search failed.";
        const results: LocationMatch[] = await res.json();
        if (!Array.isArray(results) || !results.length) return ui.enrolLocStatus.textContent = "No location matches found.";
        enrolMatches = results;

        renderEnrolLocationSuggestions(ui.enrolHomeSuggestions, results, enrolMatchIndexByLabel);
        if (results.length === 1) {
          const m = results[0];
          const label = canonicalPlaceName(m.display_name);
          setEnrolHome(Number(m.lat), Number(m.lon), label);
          ui.enrolLocStatus.textContent = "Unique match found. Nearby sites listed.";
          renderEnrolNearby(Number(m.lat), Number(m.lon));
          renderEnrolLocationSuggestions(ui.enrolHomeSuggestions, [], enrolMatchIndexByLabel);
          return;
        }
        enrolSelectedHome = null;
        ui.enrolHomeSelected.textContent = "";
        ui.enrolNearbyList.innerHTML = '<div class="meta">Select one location match to list nearby sites.</div>';
        ui.enrolLocStatus.textContent = "Select one match in the search control.";
      } catch (e) {
        ui.enrolLocStatus.textContent = "Search failed: " + errorMessage(e);
      } finally {
        hideLoading();
      }
    }
    function saveEnrolment() {
      const name = asText(ui.enrolUserName.value).trim();
      if (!name) return alert("Please provide a user name.");
      if (!enrolSelectedHome) return alert("Please select a home location.");
      profile = defaultProfile();
      profile.name = name;
      profile.homeLat = enrolSelectedHome.lat;
      profile.homeLon = enrolSelectedHome.lon;
      profile.homeLabel = enrolSelectedHome.label;
      const seeded: string[] = [];
      ui.enrolNearbyList.querySelectorAll("input[type='checkbox']:checked").forEach((c) => {
        const id = asText(c.getAttribute("data-site-id"));
        if (id) seeded.push(id);
      });
      profile.siteVisits = profile.siteVisits || {};
      for (const sid of Array.from(new Set(seeded)).sort()) {
        profile.siteVisits[sid] = [{
          id: crypto.randomUUID(),
          date: "",
          status: "visited",
          note: "",
          createdAt: nowIso(),
          updatedAt: nowIso()
        }];
      }
      connected = true;
      manuallyDisconnected = false;
      persistProfile();
      ui.enrolOverlay.style.display = "none";
      updateUserUi();
      refreshMarkers();
      map.setView([profile.homeLat, profile.homeLon], 6);
      submitAdoptionSummary().catch(() => {});
    }
    function openEnrolment() {
      ui.enrolOverlay.style.display = "flex";
      ui.enrolUserName.value = "";
      ui.enrolHomeQuery.value = "";
      renderEnrolLocationSuggestions(ui.enrolHomeSuggestions, [], enrolMatchIndexByLabel);
      ui.enrolNearbyList.innerHTML = '<div class="meta">Search for a home location, then select one match to list nearby sites.</div>';
      ui.enrolLocStatus.textContent = "";
      ui.enrolHomeSelected.textContent = "";
      enrolSelectedHome = null;
      enrolMatches = [];
    }
    function openSettings(prefill = true) {
      ui.settingsOverlay.style.display = "flex";
      if (!(prefill && profile)) return;
      ui.userName.value = asText(profile.name);
      if (Number.isFinite(profile.homeLat) && Number.isFinite(profile.homeLon)) setSelectedHome(Number(profile.homeLat), Number(profile.homeLon), asText(profile.homeLabel || "Saved home"));
      ui.visitedOnlySetting.checked = !!(profile.settings && profile.settings.visitedOnly);
      ui.dateFormat.value = asText(profile.settings && profile.settings.dateFormat) || "y-m-d";
      ui.lengthUnits.value = asText(profile.settings && profile.settings.lengthUnits) || "km";
      ui.multipleThreshold.value = String(Number(profile.settings && profile.settings.multipleThreshold) > 0 ? Number(profile.settings.multipleThreshold) : 5);
      ui.shareEnabled.checked = !!(profile.publishPreference && profile.publishPreference.enabled);
      ui.shareInterval.value = String((profile.publishPreference && profile.publishPreference.intervalDays) || 7);
      ui.shareNone.checked = profile.publishPreference && profile.publishPreference.intervalDays == null;
      ui.shareEndpoint.value = getUsageSummaryEndpoint();
      ui.shareToken.value = "";
      renderSubmitStatus();
    }
    function loadSubmitStatus() {
      try {
        const parsed: StoredStatus | null = JSON.parse(asText(localStorage.getItem(USAGE_SUBMIT_STATUS_KEY)) || "{}");
        if (!parsed || typeof parsed !== "object") return null;
        return parsed;
      } catch {
        return null;
      }
    }
    function formatSubmitStatus(status: {at?: string; state?: string; message?: string} | null) {
      const at = asText(status && status.at);
      const state = asText(status && status.state);
      const message = asText(status && status.message);
      if (!at && !state && !message) return "";
      return `Last submission: ${at || "-"} | ${state || "unknown"} | ${message || "-"}`;
    }
    function normaliseIntervalDays(rawValue: unknown, fallback = 7) {
      const n = Number(rawValue);
      if (!Number.isFinite(n) || n <= 0) return fallback;
      return Math.max(0.0001, n);
    }
    function renderSubmitStatus() {
      if (!ui.shareSubmitStatus) return;
      const status = loadSubmitStatus();
      ui.shareSubmitStatus.textContent = formatSubmitStatus(status);
    }
    function recordSubmitStatus(state: string, message: string) {
      const status = { at: nowIso(), state: asText(state), message: asText(message) };
      localStorage.setItem(USAGE_SUBMIT_STATUS_KEY, JSON.stringify(status));
      renderSubmitStatus();
    }
    function buildUsageSummary(eventType = "manual") {
      if (!profile) throw new Error("No connected profile");
      profile.usage.pendingSummaries = profile.usage.pendingSummaries || {};
      const name = asText(profile.name).trim();
      // A queued report predates a Name edit or the removed alias field. Create a
      // fresh receipt rather than changing the payload of a potentially sent Id.
      for (const key of Object.keys(profile.usage.pendingSummaries)) {
        const pending = profile.usage.pendingSummaries[key];
        if (pending && asText(pending.summary.name).trim() !== name) delete profile.usage.pendingSummaries[key];
      }
      if (eventType !== "adoption") {
        const pending = profile.usage.pendingSummaries.manual || profile.usage.pendingSummaries.periodic;
        if (pending) return pending.summary;
      }
      if (profile.usage.pendingSummaries[eventType]) return profile.usage.pendingSummaries[eventType].summary;
      let visitedSiteCount = 0;
      if (profile && profile.siteVisits) {
        for (const siteId of Object.keys(profile.siteVisits)) if (getVisitStatus(siteId) === "visited") visitedSiteCount += 1;
      }
      const summary: Summary = {
        submission_id: crypto.randomUUID(),
        submitted_at_utc: nowIso(),
        magic_cookie: asText(profile && profile.magicCookie),
        use_count_since_last_push: eventType === "adoption" ? 0 : Math.max(0, Number(profile && profile.usage && profile.usage.useCount || 0) - Number(profile && profile.usage && profile.usage.publishedUseCount || 0)),
        visited_site_count: visitedSiteCount,
        event_type: asText(eventType) || "manual",
        client_version: APP_VERSION
      };
      if (name) summary.name = name;
      profile.usage.pendingSummaries[eventType] = { summary, useCount: Number(profile.usage.useCount || 0) };
      persistProfile();
      return summary;
    }
    function isSummaryDue() {
      if (!(connected && profile)) return false;
      if (!(profile.publishPreference && profile.publishPreference.enabled)) return false;
      const intervalDays = Number(profile.publishPreference.intervalDays);
      if (!Number.isFinite(intervalDays) || intervalDays <= 0) return false;
      const last = profile.publishPreference.lastPromptAt ? Date.parse(profile.publishPreference.lastPromptAt) : NaN;
      if (!Number.isFinite(last)) return true;
      return (Date.now() - last) >= intervalDays * 86400000;
    }
    function updateSummaryReminderUi() {
      const due = isSummaryDue();
      if (ui.summaryInboxBtn) ui.summaryInboxBtn.style.display = due ? "inline-flex" : "none";
      if (ui.summaryInboxDot) ui.summaryInboxDot.style.display = due ? "block" : "none";
    }
    function startSummaryReminderWatch() {
      if (summaryReminderTimer) return;
      summaryReminderTimer = window.setInterval(() => {
        updateSummaryReminderUi();
      }, 15000);
    }
    function stopSummaryReminderWatch() {
      if (!summaryReminderTimer) return;
      window.clearInterval(summaryReminderTimer);
      summaryReminderTimer = null;
    }
    function setSubmissionDialogContent(summary: Summary) {
      const endpoint = getUsageSummaryEndpoint();
      const destination = endpoint || "Clipboard fallback";
      ui.submitSummary.innerHTML = [
        `<div><strong>Event</strong></div><div>${escapeHtml(asText(summary.event_type) || "manual")}</div>`,
        `<div><strong>Name</strong></div><div>${escapeHtml(asText(summary.name) || "Not supplied")}</div>`,
        `<div><strong>Timestamp (UTC)</strong></div><div>${escapeHtml(formatTimestampUtc(summary.submitted_at_utc))}</div>`,
        `<div><strong>Uses since last summary</strong></div><div>${escapeHtml(String(summary.use_count_since_last_push))}</div>`,
        `<div><strong>Visited site count</strong></div><div>${escapeHtml(String(summary.visited_site_count))}</div>`,
        `<div><strong>Client version</strong></div><div>${escapeHtml(asText(summary.client_version || APP_VERSION))}</div>`,
        `<div><strong>Destination</strong></div><div style="min-width:0;overflow-wrap:anywhere;">${escapeHtml(destination)}</div>`
      ].join("");
    }
    function setSubmissionDialogStatus(lines: string | string[]) {
      const text = Array.isArray(lines) ? lines.map((x) => asText(x)).join("\n") : asText(lines);
      ui.submitStatus.textContent = text || "";
    }
    function closeSubmissionDialog() {
      if (submissionInProgress) return;
      ui.submitOverlay.style.display = "none";
      pendingSummaryDialog = null;
    }
    function openSubmissionDialog(summary: Summary) {
      pendingSummaryDialog = { summary };
      setSubmissionDialogContent(summary);
      setSubmissionDialogStatus("Review and submit when ready.");
      ui.submitSend.disabled = false;
      ui.submitClose.disabled = false;
      ui.submitOverlay.style.display = "flex";
    }
    async function loadUsageHistogram() {
      const container = element("usage-histogram", "div");
      const caption = element("usage-histogram-caption", "p");
      container.replaceChildren(); caption.hidden = false; caption.textContent = "Loading distribution…";
      try {
        const url = new URL(getUsageSummaryEndpoint()); url.searchParams.set("histogram", "1");
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error("Histogram unavailable");
        const data: HistogramResponse = await response.json(); const histogram = data.histogram;
        if (!data.ok || !histogram) throw new Error("Invalid histogram");
        const bins = histogram.buckets;
        if (!Array.isArray(bins) || bins.length !== 10 || bins.some(b => !Number.isFinite(b.lower_bound) || b.lower_bound < 0 || !Number.isFinite(b.upper_bound) || b.upper_bound <= b.lower_bound || !Number.isFinite(b.height) || b.height < 0 || b.height > 1)) throw new Error("Invalid buckets");
        const width = Math.max(420, bins.length * 45 + 30), plotHeight = 130, baseline = 145, step = (width - 30) / bins.length;
        const bars = bins.map((b, i) => {
          const format = (n: number) => Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
          const label = `${format(b.lower_bound)}–${format(b.upper_bound)}`;
          const x = 20 + i * step, height = b.height * plotHeight;
          return `<rect x="${x}" y="${baseline-height}" width="${Math.max(1,step-3)}" height="${height}" fill="#287b8e"/><text x="${x+step/2}" y="${baseline+16}" transform="rotate(45 ${x+step/2} ${baseline+16})" font-size="11" fill="#334155">${escapeHtml(label)}</text>`;
        }).join("");
        container.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="205" role="img" aria-label="Distribution of visited sites in ten scaled ranges, with an unscaled frequency axis"><line x1="18" y1="${baseline}" x2="${width}" y2="${baseline}" stroke="#64748b"/>${bars}</svg>`;
        caption.textContent = ""; caption.hidden = true;
      } catch { container.replaceChildren(); caption.textContent = "The usage distribution is temporarily unavailable."; }
    }
    async function runSubmissionDialogSend() {
      if (!(pendingSummaryDialog && pendingSummaryDialog.summary)) return;
      const summary = pendingSummaryDialog.summary;
      submissionInProgress = true;
      ui.submitSend.disabled = true;
      ui.submitClose.disabled = true;
      setSubmissionDialogStatus("Submitting usage summary...");
      let timedOut = false;
      const timeoutHandle = window.setTimeout(() => {
        timedOut = true;
        setSubmissionDialogStatus([
          "Submission response timed out.",
          "You may close this dialog and retry later; an accepted submission will not be counted twice."
        ]);
        submissionInProgress = false;
        ui.submitClose.disabled = false;
      }, 20000);

      let submitted: SubmissionResult = { ok: false, reason: "Submission timed out." };
      try {
        submitted = await submitUsageSummary(summary);
      } finally {
        if (!timedOut) window.clearTimeout(timeoutHandle);
      }
      if (timedOut) return;

      if (!profile) return;
      profile.publishPreference.lastPromptAt = nowIso();
      let sent = submitted.ok === true;
      if (!sent) {
        try { sent = await copySummaryToClipboard(summary); } catch {}
      }
      if (submitted.ok === true) {
        const pending = profile.usage.pendingSummaries && profile.usage.pendingSummaries[summary.event_type];
        if (pending && pending.summary.submission_id === summary.submission_id) {
          profile.usage.publishedUseCount = Math.max(Number(profile.usage.publishedUseCount || 0), pending.useCount);
          delete profile.usage.pendingSummaries?.[summary.event_type];
        }
      }
      persistProfile();
      updateSummaryReminderUi();

      const stats = submitted && submitted.stats ? submitted.stats : await fetchUsageStats();
      const statsLine = formatStatsLine(stats);
      const lines = [];
      if (submitted.ok) {
        if (submitted.duplicate) {
          lines.push("A recent summary from this profile was already recorded.");
          lines.push("No further action is required.");
          recordSubmitStatus("duplicate", `Recent summary already recorded.${statsLine ? " " + statsLine : ""}`);
        } else {
          lines.push("Summary received.");
          lines.push("Thank you for supporting My World Heritage.");
          recordSubmitStatus("submitted", `Summary received.${statsLine ? " " + statsLine : ""}`);
        }
      } else if (sent) {
        lines.push("Direct submit failed.");
        lines.push("Summary copied to clipboard for manual use.");
        recordSubmitStatus("clipboard_fallback", `Direct submit failed (${asText(submitted.reason)}); copied to clipboard.`);
      } else {
        lines.push("Submission failed.");
        lines.push(asText(submitted.reason) || "Unknown error.");
        recordSubmitStatus("failed", `Submission failed (${asText(submitted.reason)}).`);
      }
      if (statsLine) {
        lines.push("");
        lines.push(statsLine);
      }
      setSubmissionDialogStatus(lines);
      submissionInProgress = false;
      ui.submitClose.disabled = false;
    }
    function saveSettings() {
      const enteredEndpoint = ui.shareEndpoint.value.trim();
      if (enteredEndpoint) {
        try {
          const url = new URL(enteredEndpoint);
          if (!["https:", "http:"].includes(url.protocol)) throw new Error();
        } catch { ui.shareEndpoint.setCustomValidity("Enter a complete HTTP or HTTPS reporting URL, or leave blank for the default."); ui.shareEndpoint.reportValidity(); return; }
      }
      ui.shareEndpoint.setCustomValidity("");
      const name = asText(ui.userName.value).trim();
      if (!name) return alert("Please provide a user name.");
      if (!selectedHome) return alert("Please select a home location.");
      if (!profile) profile = defaultProfile();
      profile.schemaVersion = PROFILE_SCHEMA_VERSION;
      profile.name = name;
      profile.homeLat = selectedHome.lat;
      profile.homeLon = selectedHome.lon;
      profile.homeLabel = selectedHome.label;
      profile.siteVisits = profile.siteVisits || {};
      profile.inspectedSiteIds = Array.from(new Set(profile.inspectedSiteIds || [])).sort();
      profile.settings = profile.settings || {};
      profile.settings.visitedOnly = !!ui.visitedOnlySetting.checked;
      profile.settings.dateFormat = asText(ui.dateFormat.value) || "y-m-d";
      profile.settings.lengthUnits = asText(ui.lengthUnits.value) || "km";
      profile.settings.multipleThreshold = Math.max(1, Number(ui.multipleThreshold.value || 5));
      profile.settings.usageSummaryEndpoint = asText(ui.shareEndpoint.value).trim();
      profile.settings.usageSummaryToken = asText(ui.shareToken.value).trim();
      profile.publishPreference = profile.publishPreference || {};
      profile.publishPreference.enabled = !!ui.shareEnabled.checked;
      profile.publishPreference.intervalDays = ui.shareNone.checked ? null : normaliseIntervalDays(ui.shareInterval.value, 7);
      if (profile.publishPreference.consentAskedAtStartup == null) profile.publishPreference.consentAskedAtStartup = true;
      profile.magicCookie = profile.magicCookie || randomCookie();
      profile.usage = profile.usage || { firstUseAt: nowIso(), lastUseAt: nowIso(), useCount: 0, inspectCount: 0, publishedUseCount: 0 };
      connected = true;
      manuallyDisconnected = false;
      persistProfile();
      ui.settingsOverlay.style.display = "none";
      updateUserUi();
      rebuildComponentIndexes();
      refreshMarkers();
      renderSiteList(asText(ui.siteListMode.value));
      applyScaleUnits();
    }
    function connectSilently() {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) {
        connected = false;
        profile = null;
        stopSummaryReminderWatch();
        updateUserUi();
        openEnrolment();
        return;
      }
      try {
        const parsed: Profile = JSON.parse(raw);
        const v = verifyProfile(parsed);
        if (!v.ok) throw new Error(v.reason);
        profile = parsed;
        profile.siteVisits = profile.siteVisits || {};
        delete profile.visitedSiteIds;
        delete profile.siteStatuses;
        profile.settings = profile.settings || {};
        if (!profile.settings.dateFormat) profile.settings.dateFormat = "y-m-d";
        if (!profile.settings.lengthUnits) profile.settings.lengthUnits = "km";
        if (!(Number(profile.settings.multipleThreshold) > 0)) profile.settings.multipleThreshold = 5;
        if (profile.settings.usageSummaryEndpoint == null) profile.settings.usageSummaryEndpoint = "";
        if (profile.settings.usageSummaryToken == null) profile.settings.usageSummaryToken = "";
        connected = true;
        manuallyDisconnected = false;
        profile.usage.useCount = Number(profile.usage.useCount || 0) + 1;
        profile.usage.publishedUseCount = Number(profile.usage.publishedUseCount || 0);
        profile.usage.lastUseAt = nowIso();
        persistProfile();
      } catch (e) {
        connected = false;
        profile = null;
        alert("Stored profile is incompatible: " + errorMessage(e) + ". Please import a compatible file or reset.");
      }
      updateUserUi();
      rebuildComponentIndexes();
      refreshMarkers();
      applyScaleUnits();
      ensureStartupConsentPrompt();
      updateSummaryReminderUi();
      startSummaryReminderWatch();
      void maybePromptPublishSummary(false);
    }
    function disconnect() {
      connected = false;
      profile = null;
      manuallyDisconnected = true;
      stopSummaryReminderWatch();
      updateUserUi();
      refreshMarkers();
      clearSelection();
    }
    function exportProfile() {
      if (!connected || !profile) return alert("No connected profile to export.");
      const payload = { app: "My World Heritage", schemaVersion: PROFILE_SCHEMA_VERSION, exportedAt: nowIso(), profile };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const safeUser = asText(profile.name || "User").trim().replace(/[\\/:*?"<>|]/g, "_") || "User";
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `My World Heritage - ${safeUser}.profile`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
    }
    function importProfileFile(file: File) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const obj: {schemaVersion: number; profile: Profile} = JSON.parse(asText(reader.result));
          if (!(obj && obj.schemaVersion === PROFILE_SCHEMA_VERSION && obj.profile)) throw new Error("Unsupported import format");
          const v = verifyProfile(obj.profile); if (!v.ok) throw new Error(v.reason);
          localStorage.setItem(PROFILE_KEY, JSON.stringify(obj.profile));
          connectSilently();
        } catch (e) { alert("Import failed: " + errorMessage(e)); }
      };
      reader.readAsText(file);
    }
    function parseWhsKeyQuery(query: string) {
      const m = asText(query).trim().toLowerCase().match(/^(?:whs\s*)?(\d{1,6})$/);
      if (!m) return "";
      const normalized = m[1].replace(/^0+/, "");
      return normalized || "0";
    }
    function rootWhsIdForProps(p: SiteProperties) {
      const id = asText(p && p.site_id).trim();
      const parent = asText(p && p.parent_site_id).trim();
      const whsDirect = id.match(WHS_ID_RE);
      if (whsDirect) return whsDirect[1];
      const mwhDirect = id.match(MWH_ID_RE);
      if (mwhDirect) return mwhDirect[1];
      const whsParent = parent.match(WHS_ID_RE);
      if (whsParent) return whsParent[1];
      throw new Error(`Invalid dataset id shape: site_id=${id || "<empty>"} parent_site_id=${parent || "<empty>"}`);
    }
    function buildWhsSearchResults(query: string): WhsResult[] {
      const q = query.toLowerCase().trim();
      const whsKeyQuery = parseWhsKeyQuery(query);
      const rows: WhsResult[] = [];
      for (const f of whsData?.features || []) {
        const p = f.properties || {};
        const name = displayName(p);
        const id = asText(p.site_id);
        const scope = asText(p.site_scope);
        const parentId = asText(p.parent_site_id);
        const rootWhsId = rootWhsIdForProps(p);
        const country = asText(p.country).toLowerCase();
        const nameNative = asText(p.name).toLowerCase();
        const nameEnglish = asText(p.name_en).toLowerCase();
        const aliasList = Array.isArray(p.aliases) ? p.aliases : [];
        const aliases = aliasList.join(" ").toLowerCase();
        const haystack = `${name.toLowerCase()} ${nameNative} ${nameEnglish} ${id.toLowerCase()} ${country} ${aliases} whs ${rootWhsId}`;
        if (whsKeyQuery) {
          if (!(rootWhsId === whsKeyQuery)) continue;
        } else if (!haystack.includes(q)) continue;

        let score = 0;
        if (whsKeyQuery) score += rootWhsId === whsKeyQuery ? 300 : 0;
        if (nameEnglish === q || nameNative === q) score += 100;
        else if (nameEnglish.includes(q) || nameNative.includes(q)) score += 60;
        if (country === q) score += 30;
        else if (country.includes(q)) score += 15;
        if (id === q) score += 90;
        if (rootWhsId && rootWhsId === q) score += 110;
        for (const a of aliasList) if (asText(a).toLowerCase().includes(q)) score += 50;

        let matchedPoint: {lat:number; lon:number} | null = null;
        const aliasPoints = Array.isArray(p.alias_points) ? p.alias_points : [];
        for (const ap of aliasPoints) {
          const aliasName = asText(ap && ap.name).toLowerCase();
          if (!aliasName || !aliasName.includes(q)) continue;
          const lat = Number(ap.lat); const lon = Number(ap.lon);
          if (Number.isFinite(lat) && Number.isFinite(lon)) { matchedPoint = { lat, lon }; break; }
        }

        const subtitle = scope === "component" && parentId ? `Component ${id} of ${parentId}` : id;
        rows.push({ type: "whs", feature: f, title: name || "Unnamed site", subtitle, score, matchedPoint });
      }
      rows.sort((a, b) => b.score - a.score || asText(a.title).localeCompare(asText(b.title)));
      return rows;
    }
    async function buildGeoSearchResults(query: string): Promise<GeoResult[]> {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=${encodeURIComponent(query)}`);
        if (!res.ok) return [];
        const data: LocationMatch[] = await res.json();
        return data.map(x => ({ type: "geo", lat: Number(x.lat), lon: Number(x.lon), bbox: Array.isArray(x.boundingbox) ? x.boundingbox.map(Number) : null, title: asText(x.display_name).split(",")[0], subtitle: asText(x.display_name) }));
      } catch {
        return [];
      }
    }
    function findSitesInBBox(bbox: number[] | null) {
      if (!bbox || bbox.length < 4 || !whsData || !Array.isArray(whsData.features)) return [];
      const south = Number(bbox[0]); const north = Number(bbox[1]); const west = Number(bbox[2]); const east = Number(bbox[3]);
      if (![south, north, west, east].every(Number.isFinite)) return [];
      return whsData.features.filter((f) => {
        if (!f.geometry || f.geometry.type !== "Point") return false;
        const lon = Number(f.geometry.coordinates[0]);
        const lat = Number(f.geometry.coordinates[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
        return lat >= south && lat <= north && lon >= west && lon <= east;
      });
    }
    async function runSearch() {
      const q = asText(ui.searchInput.value).trim(); if (!q) { lastSearchedSiteIds = []; searchFocusBySiteId.clear(); explicitVisibleSiteIds = new Set<string>(); ui.searchResults.style.display = "none"; ui.searchResults.innerHTML = ""; refreshMarkers(); renderSiteList(asText(ui.siteListMode.value)); return; }
      explicitVisibleSiteIds = new Set<string>();
      showLoading("Loading ...");
      try {
        const whsRows = buildWhsSearchResults(q);
        const geoRows = await buildGeoSearchResults(q);
        searchFocusBySiteId.clear();
        for (const r of whsRows) {
          const sid = asText(r.feature && r.feature.properties && r.feature.properties.site_id);
          if (!sid || !r.matchedPoint) continue;
          searchFocusBySiteId.set(sid, r.matchedPoint);
        }
        lastSearchedSiteIds = whsRows.map((r) => asText(r.feature && r.feature.properties && r.feature.properties.site_id)).filter(Boolean);
        for (const sid of lastSearchedSiteIds) explicitVisibleSiteIds.add(sid);
        refreshMarkers();
        if (!lastSearchedSiteIds.length && geoRows.length && geoRows[0].bbox) {
          const bboxMatches = findSitesInBBox(geoRows[0].bbox);
          lastSearchedSiteIds = bboxMatches.map((f) => asText(f.properties && f.properties.site_id)).filter(Boolean);
          for (const sid of lastSearchedSiteIds) explicitVisibleSiteIds.add(sid);
          refreshMarkers();
        }
        const rows = [...whsRows.slice(0, 20), ...geoRows].slice(0, 24); ui.searchResults.innerHTML = "";
        ui.siteListMode.value = "searched";
        renderSiteList("searched");
        if (whsRows.length === 1) {
          const one = whsRows[0];
          if (one.matchedPoint) map.setView([one.matchedPoint.lat, one.matchedPoint.lon], 10);
          else {
            const f = one.feature;
            map.setView([Number(f.geometry.coordinates[1]), Number(f.geometry.coordinates[0])], 10);
          }
        } else if (rows.length === 1) {
          const only = rows[0];
          if (only.type === "geo") map.setView([only.lat, only.lon], 10);
        }
        for (const row of rows) { const div = document.createElement("div"); div.className = "result-row"; div.innerHTML = `<strong>${row.title}</strong><br><span class="result-meta">${row.subtitle}</span>`; div.addEventListener("click", () => { if (row.type === "whs") { const f = row.feature; const sid = asText(f && f.properties && f.properties.site_id); explicitVisibleSiteIds.add(sid); refreshMarkers(sid); selectionContext = "search"; if (row.matchedPoint) map.setView([row.matchedPoint.lat, row.matchedPoint.lon], 10); else map.setView([Number(f.geometry.coordinates[1]), Number(f.geometry.coordinates[0])], 10); renderDetail(f); } else { map.setView([row.lat, row.lon], 10); clearSelection(); } ui.searchResults.style.display = "none"; }); ui.searchResults.appendChild(div); }
        ui.searchResults.style.display = rows.length ? "block" : "none";
      } finally {
        hideLoading();
      }
    }
    function getUsageSummaryEndpoint() {
      const saved = localStorage.getItem(USAGE_ENDPOINT_STORAGE_KEY);
      return resolveUsageEndpoint(saved ?? profile?.settings?.usageSummaryEndpoint);
    }
    function resolveUsageEndpoint(value: unknown) {
      const endpoint = typeof value === "string" ? value.trim() : "";
      return !endpoint || endpoint === USAGE_SUMMARY_ENDPOINTS.previous ? USAGE_SUMMARY_ENDPOINTS.current : endpoint;
    }
    function migrateUsageSettings(target: Profile | null) {
      if (!target || typeof target !== "object" || Array.isArray(target)) return;
      if (!target.settings || typeof target.settings !== "object" || Array.isArray(target.settings)) target.settings = defaultProfile().settings;
      target.settings.usageSummaryEndpoint = resolveUsageEndpoint(target.settings.usageSummaryEndpoint);
      target.settings.usageSummaryToken = "";
    }
    function migrateStoredUsageSettings() {
      const raw = localStorage.getItem(PROFILE_KEY);
      let stored: Profile | null = null;
      try {
        const parsed: Profile | null = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) stored = parsed;
      } catch { /* Preserve unreadable profiles for the existing recovery flow. */ }
      const endpoint = resolveUsageEndpoint(localStorage.getItem(USAGE_ENDPOINT_STORAGE_KEY) ?? stored?.settings?.usageSummaryEndpoint);
      localStorage.setItem(USAGE_ENDPOINT_STORAGE_KEY, endpoint);
      localStorage.removeItem("mwh_usage_summary_token");
      if (stored) {
        migrateUsageSettings(stored);
        stored.settings.usageSummaryEndpoint = endpoint;
        localStorage.setItem(PROFILE_KEY, JSON.stringify(stored));
      }
    }
    async function fetchUsageStats(): Promise<UsageStats | null> {
      const endpoint = getUsageSummaryEndpoint();
      if (!endpoint) return null;
      try {
        const sep = endpoint.includes("?") ? "&" : "?";
        const url = `${endpoint}${sep}stats=1`;
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) return null;
        const payload: StatsResponse = await res.json();
        if (!(payload && payload.ok && payload.stats)) return null;
        return payload.stats;
      } catch {
        return null;
      }
    }
    function formatStatsLine(stats: UsageStats | null) {
      if (!stats || typeof stats !== "object") return "";
      const encouragement = asText(stats.encouragement).trim();
      if (encouragement) return encouragement;
      const active = Number(stats.active_datasets || stats.unique_datasets || 0);
      const avgVisited = Number(stats.average_visited_sites);
      if (!Number.isFinite(active) || !Number.isFinite(avgVisited)) return "";
      return `Recent usage: ${active} active users, average visited sites ${Math.round(avgVisited)}.`;
    }
    async function submitUsageSummary(summary: Summary): Promise<SubmissionResult> {
      const endpoint = getUsageSummaryEndpoint();
      if (!endpoint) return { ok: false, reason: "No endpoint configured." };
      try {
                const payload = {
          ...summary,
          source: "my-world-heritage",
          user_agent: asText(navigator.userAgent).slice(0, 512)
        };
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(18000),
          body: JSON.stringify(payload)
        });
        const raw = await res.text();
        let parsed: Receipt | null = null;
        try { parsed = raw ? JSON.parse(raw) : null; } catch {}
        if (!res.ok) return { ok: false, reason: `HTTP ${res.status}`, detail: asText(raw).slice(0, 240) };
        if (!parsed || parsed.ok !== true) return { ok: false, reason: asText(parsed && parsed.error) || "Endpoint did not confirm receipt." };
        if (parsed.submission_id !== summary.submission_id) return { ok: false, reason: "Endpoint did not acknowledge this submission." };
        return { ok: true, duplicate: !!(parsed && parsed.duplicate), detail: asText(raw).slice(0, 240), stats: parsed && parsed.stats ? parsed.stats : null };
      } catch (e) {
        const reason = asText(e && errorMessage(e)) || "Submission failed.";
        return { ok: false, reason: reason };
      }
    }
    async function copySummaryToClipboard(summary: Summary) {
      if (!navigator.clipboard) return false;
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
      return true;
    }
    async function maybePromptPublishSummary(force = false) {
      if (!connected || !profile) return;
      if (force) {
        openSubmissionDialog(buildUsageSummary("manual"));
        return;
      }
      if (!isSummaryDue()) return;
      openSubmissionDialog(buildUsageSummary("periodic"));
    }
    async function submitAdoptionSummary() {
      if (!(connected && profile)) return;
      const summary = buildUsageSummary("adoption");
      summary.use_count_since_last_push = 0;
      const submitted = await submitUsageSummary(summary);
      const stats = submitted && submitted.stats ? submitted.stats : await fetchUsageStats();
      const statsLine = formatStatsLine(stats);
      if (!submitted.ok) {
        recordSubmitStatus("adoption_failed", `Adoption submission failed.${statsLine ? " " + statsLine : ""}`);
        return;
      }
      {
        delete profile.usage.pendingSummaries?.adoption;
        persistProfile();
      }
      if (submitted.duplicate) {
        recordSubmitStatus("adoption_duplicate", `Adoption summary already recently recorded.${statsLine ? " " + statsLine : ""}`);
        return;
      }
      recordSubmitStatus("adoption_submitted", `Adoption summary received.${statsLine ? " " + statsLine : ""}`);
    }
    function ensureStartupConsentPrompt() {
      if (!connected || !profile) return;
      profile.publishPreference = profile.publishPreference || { enabled: false, intervalDays: 7, lastPromptAt: null, consentAskedAtStartup: false };
      if (profile.publishPreference.consentAskedAtStartup) return;
      if (profile.publishPreference.enabled == null) profile.publishPreference.enabled = false;
      if (profile.publishPreference.intervalDays == null) profile.publishPreference.intervalDays = 7;
      profile.publishPreference.consentAskedAtStartup = true;
      persistProfile();
    }
    function closeTransientUi() {
      ui.helpOverlay.style.display = "none";
      ui.settingsOverlay.style.display = "none";
      ui.enrolOverlay.style.display = "none";
      if (ui.submitOverlay.style.display !== "none") closeSubmissionDialog();
      ui.userMenu.style.display = "none";
      ui.searchResults.style.display = "none";
      selectionContext = "";
      if (ui.detailPane.style.display !== "none") clearSelection();
    }
    function openAppDialog() {
      ui.helpOverlay.style.display = "flex";
      void loadUsageHistogram();
    }
    function scheduleStartupHelp() {
      const events = ["pointerdown", "keydown", "wheel", "touchstart"];
      const cleanup = () => events.forEach(name => document.removeEventListener(name, cancel, true));
      const cancel = () => { window.clearTimeout(timer); cleanup(); };
      const timer = window.setTimeout(() => {
        cleanup();
        if (document.visibilityState !== "visible") return;
        const dialogOpen = Array.from(document.querySelectorAll(".modal-overlay")).some(el => getComputedStyle(el).display !== "none");
        if (!dialogOpen) openAppDialog();
      }, 60000);
      events.forEach(name => document.addEventListener(name, cancel, { capture: true, passive: true }));
    }
    function wireUi() {
      element("search-btn", "button").addEventListener("click", runSearch);
      element("copy-snapshot-btn", "button").addEventListener("click", copySnapshot);
      ui.summaryInboxBtn.addEventListener("click", () => { maybePromptPublishSummary(false); ui.userMenu.style.display = "none"; });
      ui.submitSend.addEventListener("click", runSubmissionDialogSend);
      ui.submitClose.addEventListener("click", closeSubmissionDialog);
      ui.searchInput.addEventListener("keydown", (e) => { if (e.key === "Escape") closeTransientUi(); if (e.key === "Enter") { e.preventDefault(); runSearch(); } });
      ui.siteListMode.addEventListener("change", () => { renderSiteList(asText(ui.siteListMode.value)); });
      ui.appTitleBtn.addEventListener("click", openAppDialog);
      element("help-close", "button").addEventListener("click", () => { ui.helpOverlay.style.display = "none"; });
      ui.userMenuToggle.addEventListener("click", () => { ui.userMenu.style.display = ui.userMenu.style.display === "block" ? "none" : "block"; });
      window.addEventListener("click", (e) => { if (!element("user-menu-wrap", "div").contains(e.target instanceof Node ? e.target : null)) ui.userMenu.style.display = "none"; });
      element("menu-connect", "button").addEventListener("click", () => { connectSilently(); ui.userMenu.style.display = "none"; });
      element("menu-settings", "button").addEventListener("click", () => { openSettings(true); ui.userMenu.style.display = "none"; });
      element("menu-export", "button").addEventListener("click", () => { exportProfile(); ui.userMenu.style.display = "none"; });
      element("menu-import", "button").addEventListener("click", () => { ui.importFile.click(); ui.userMenu.style.display = "none"; });
      if (ui.menuSummary) ui.menuSummary.addEventListener("click", () => { exportVisitedSummaryReport(); ui.userMenu.style.display = "none"; });
      if (ui.menuSubmit && flags.submitEnabled) ui.menuSubmit.addEventListener("click", () => { maybePromptPublishSummary(true); ui.userMenu.style.display = "none"; });
      if (ui.menuReset && flags.resetEnabled) ui.menuReset.addEventListener("click", () => { if (!confirm("Reset local test data and reload?")) return; localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(CENSUS_KEY); location.reload(); });
      element("menu-logout", "button").addEventListener("click", () => { disconnect(); ui.userMenu.style.display = "none"; });
      ui.importFile.addEventListener("change", () => { const f = ui.importFile.files && ui.importFile.files[0]; if (f) importProfileFile(f); ui.importFile.value = ""; });
      element("home-search", "button").addEventListener("click", searchHomeLocation);
      ui.homeQuery.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); searchHomeLocation(); } });
      ui.homeQuery.addEventListener("change", () => { applyHomeSelectionFromInput(); });
      element("use-my-location", "button").addEventListener("click", () => { if (!navigator.geolocation) { ui.locStatus.textContent = "Geolocation not supported."; return; } ui.locStatus.textContent = "Locating..."; navigator.geolocation.getCurrentPosition((pos) => { setSelectedHome(pos.coords.latitude, pos.coords.longitude, "Current device location"); ui.homeMatchesList.innerHTML = ""; homeMatchIndexByLabel.clear(); homeMatches = []; ui.locStatus.textContent = "Location set."; }, (err) => { ui.locStatus.textContent = "Location failed: " + err.message; }, { timeout: 10000, maximumAge: 300000 }); });
      ui.shareInfoLink.addEventListener("click", (e) => {
        e.preventDefault();
        ui.shareInfoBubble.style.display = ui.shareInfoBubble.style.display === "block" ? "none" : "block";
      });
      element("enrol-home-search", "button").addEventListener("click", searchEnrolHomeLocation);
      ui.enrolHomeQuery.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); searchEnrolHomeLocation(); } });
      ui.enrolHomeQuery.addEventListener("change", () => { applyEnrolSelectionFromInput(); });
      element("enrol-use-my-location", "button").addEventListener("click", () => {
        if (!navigator.geolocation) { ui.enrolLocStatus.textContent = "Geolocation not supported."; return; }
        ui.enrolLocStatus.textContent = "Locating...";
        navigator.geolocation.getCurrentPosition((pos) => {
          setEnrolHome(pos.coords.latitude, pos.coords.longitude, "Current device location");
          renderEnrolLocationSuggestions(ui.enrolHomeSuggestions, [], enrolMatchIndexByLabel);
          enrolMatches = [];
          ui.enrolLocStatus.textContent = "Location selected. Nearby sites listed.";
          renderEnrolNearby(pos.coords.latitude, pos.coords.longitude);
        }, (err) => { ui.enrolLocStatus.textContent = "Location failed: " + err.message; }, { timeout: 10000, maximumAge: 300000 });
      });
      ui.enrolHomeSuggestions.addEventListener("click", (ev) => {
        const row = ev.target instanceof Element ? ev.target.closest("[data-match-index]") : null;
        if (!row) return;
        const idx = Number(row.getAttribute("data-match-index"));
        if (!Number.isFinite(idx) || !enrolMatches[idx]) return;
        const match = enrolMatches[idx];
        const label = compactPlaceLabel(match.display_name);
        ui.enrolHomeQuery.value = label;
        setEnrolHome(Number(match.lat), Number(match.lon), canonicalPlaceName(match.display_name), false);
        ui.enrolLocStatus.textContent = "Location selected. Nearby sites listed.";
        renderEnrolNearby(Number(match.lat), Number(match.lon));
        renderEnrolLocationSuggestions(ui.enrolHomeSuggestions, [], enrolMatchIndexByLabel);
      });
      element("enrol-save", "button").addEventListener("click", saveEnrolment);
      element("settings-save", "button").addEventListener("click", saveSettings);
      map.on("click", () => {
        if (Date.now() < ignoreMapClickUntil) return;
        clearSelection();
      });
      document.addEventListener("keydown", (ev) => { if (ev.key !== "Escape") return; closeTransientUi(); });
      map.on("moveend", () => {
        const c = map.getCenter();
        localStorage.setItem(MAP_VIEW_KEY, JSON.stringify({ lat: c.lat, lon: c.lng, zoom: map.getZoom() }));
      });
    }
    function updateExtractStatus(status: Record<string, unknown> | null | undefined) {
      if (!status || typeof status !== "object") return;
      ui.extractStatusResult.textContent = asText(status.result) || "Unknown";
      ui.extractStatusSource.textContent = asText(status.source) || "-";
      ui.extractStatusCount.textContent = asText(status.count) || "-";
      ui.extractStatusInput.textContent = status.input_bytes == null ? "-" : `${status.input_bytes} bytes`;
      ui.extractStatusSize.textContent = status.dataset_bytes == null ? "-" : `${status.dataset_bytes} bytes`;
      ui.extractStatusDataAt.textContent = asText(status.most_recent_data) || "-";
      ui.extractStatusAttemptAt.textContent = asText(status.most_recent_attempt) || "-";
      ui.extractStatusRetry.textContent = status.retry_interval_days == null ? "-" : `every ${status.retry_interval_days} days`;
    }
    function renderAppVersion() {
      if (!ui.appVersion) return;
      ui.appVersion.textContent = APP_VERSION;
    }

    function bootData() {
      showLoading("Loading ...");
      fetch("../data/current/unesco_official_sites.json", { cache: "no-store" }).then(r => r.json()).then((statusData: ExtractDocument) => {
        updateExtractStatus(statusData && statusData.metadata && statusData.metadata.extract_status);
      }).catch(() => {});
      fetch("../data/current/unesco_official_sites.geojson", { cache: "no-store" }).then(r => r.json()).then((data: Catalogue & ExtractDocument) => {
        whsData = data;
        updateExtractStatus(data && data.metadata && data.metadata.extract_status);
        layer = L.geoJSON<SiteProperties, import("geojson").Point>(data, {
          pointToLayer: (feature, latlng) => L.circleMarker(latlng, markerStyle(asText(feature && feature.properties && feature.properties.site_id))),
          onEachFeature: (feature, marker) => {
            const siteId = asText(feature && feature.properties && feature.properties.site_id);
            if (!(marker instanceof L.CircleMarker)) throw new Error("Expected point marker");
            markersBySiteId.set(siteId, marker);
            marker.bindTooltip(tooltipContent(feature), { direction: "top", opacity: 0.95 });
            marker.on("click", (ev) => {
              ignoreMapClickUntil = Date.now() + 250;
              selectionContext = "map";
              renderDetail(feature);
              if (ev && ev.originalEvent) L.DomEvent.stop(ev.originalEvent);
            });
            marker.on("dblclick", (ev) => {
              if (!(connected && profile)) return;
              const current = getVisitStatus(siteId);
              setVisitStatus(siteId, current === "visited" ? "not_visited" : "visited");
              refreshMarkers();
              if (selectedSiteId === siteId) renderDetail(feature);
              if (ev && ev.originalEvent) L.DomEvent.stop(ev.originalEvent);
            });
          }
        }).addTo(map);
        rebuildComponentIndexes();
        const savedViewRaw = localStorage.getItem(MAP_VIEW_KEY);
        let restored = false;
        if (savedViewRaw) {
          try {
            const saved: {lat:number; lon:number; zoom:number} = JSON.parse(savedViewRaw);
            if (Number.isFinite(saved.lat) && Number.isFinite(saved.lon) && Number.isFinite(saved.zoom)) {
              map.setView([saved.lat, saved.lon], saved.zoom);
              restored = true;
            }
          } catch {}
        }
        if (!restored) {
          if (layer.getLayers && layer.getLayers().length) map.fitBounds(layer.getBounds(), { padding: [20, 20] });
          else map.setView([20, 0], 2);
        }
        incrementCensusUse();
        connectSilently();
        refreshMarkers();
        if (!connected && !localStorage.getItem(PROFILE_KEY)) openEnrolment();
        hideLoading();
      }).catch((err: unknown) => { hideLoading(); ui.detailPane.style.display = "block"; ui.detailPane.innerHTML = `<p>Failed to load local data: ${asText(err)}</p>`; });
    }
    migrateStoredUsageSettings();
    applyFeatureFlags();
    wireUi();
    renderAppVersion();
    updateUserUi();
    applyScaleUnits();
    bootData();
    scheduleStartupHelp();
