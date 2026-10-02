export interface SiteProperties {
  site_id?: string; parent_site_id?: string; site_scope?: string; status?: string;
  name?: string; name_en?: string; native_display?: string;
  native_names?: Record<string, string>; aliases?: string[];
  alias_points?: {name: string; lat: number; lon: number}[];
  country?: string; inscription_date?: string; category?: string; note?: string;
  unesco_url?: string; component_ref?: string; component_count?: number;
  criteria?: string; criteria_txt?: string; source?: string;
  description?: string; wikipedia?: string; whc_criteria?: string;
}
export type Site = import('geojson').Feature<import('geojson').Point, SiteProperties>;
export type Catalogue = import('geojson').FeatureCollection<import('geojson').Point, SiteProperties>;
export interface Visit { id: string; date: string; status: string; note: string; createdAt: string; updatedAt: string }
export interface Settings {
  visitedOnly: boolean; dateFormat: string; lengthUnits: string; multipleThreshold: number;
  usageSummaryEndpoint: string; usageSummaryToken: string;
}
export interface Summary {
  submission_id: string; submitted_at_utc: string; magic_cookie: string;
  use_count_since_last_push: number; visited_site_count: number;
  event_type: string; client_version: string; name?: string;
}
export interface Profile {
  schemaVersion: number; name: string; homeLat: number | null; homeLon: number | null; homeLabel: string;
  siteVisits: Record<string, Visit[]>; inspectedSiteIds: string[]; settings: Settings;
  usage: { firstUseAt: string; lastUseAt: string; useCount: number; inspectCount: number;
    publishedUseCount: number; pendingSummaries?: Record<string, {summary: Summary; useCount: number}> };
  publishPreference: {enabled: boolean; intervalDays: number | null; lastPromptAt: string | null; consentAskedAtStartup: boolean};
  magicCookie: string; updatedAt: string;
  visitedSiteIds?: unknown; siteStatuses?: unknown;
}
export interface Place {lat: number; lon: number; label: string}
export interface LocationMatch {lat: string | number; lon: string | number; display_name: string; boundingbox?: string[]}
export interface ReportRow {siteId: string; name: string; country: string; status: string; latestVisitRaw: string; latestVisitDisplay: string; feature: Site}
export interface UsageStats {encouragement?: string; active_datasets?: number; unique_datasets?: number; average_visited_sites?: number}
export interface SubmissionResult {ok: boolean; reason?: string; detail?: string; duplicate?: boolean; stats?: UsageStats | null; unverified?: boolean}
export interface WhsResult {type: 'whs'; feature: Site; title: string; subtitle: string; score: number; matchedPoint: {lat: number; lon: number} | null}
export interface GeoResult {type: 'geo'; lat: number; lon: number; bbox: number[] | null; title: string; subtitle: string}
export interface Receipt {ok?: boolean; submission_id?: string; duplicate?: boolean; error?: string; stats?: UsageStats}
export interface StatsResponse {ok?: boolean; stats?: UsageStats}
export interface HistogramResponse {ok?: boolean; histogram?: {buckets: {lower_bound:number; upper_bound:number; height:number}[]}}
export interface StoredStatus {at?: string; state?: string; message?: string}
export interface ExtractDocument {metadata?: {extract_status?: Record<string, unknown>}}
