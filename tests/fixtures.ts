import assert from 'node:assert/strict';
import type {Profile} from '../site/src/types.js';
export {object, text} from '../supabase/functions/_shared/contracts.ts';
export function jsonBody(options?: RequestInit): unknown {
  assert.equal(typeof options?.body, 'string', 'Expected a JSON request body');
  return JSON.parse(String(options?.body));
}
export function fixtureProfile(): Profile {
  return {schemaVersion:1,name:'',homeLat:null,homeLon:null,homeLabel:'',magicCookie:'fixture',updatedAt:'',
    settings:{visitedOnly:false,dateFormat:'',lengthUnits:'',multipleThreshold:10,usageSummaryEndpoint:'',usageSummaryToken:''},
    usage:{firstUseAt:'',lastUseAt:'',useCount:0,inspectCount:0,publishedUseCount:0,pendingSummaries:{}},
    publishPreference:{enabled:false,intervalDays:null,lastPromptAt:null,consentAskedAtStartup:false},
    inspectedSiteIds:[],siteVisits:{}};
}
