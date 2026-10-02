"""Prepare a private, repeatable SQL import from the owner's Google Sheets XLSX export."""
import argparse
from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import re
import shutil
import xml.etree.ElementTree as ET
import zipfile

NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
EVENTS = {'adoption', 'manual', 'periodic', 'patch'}
TEST_SOURCES = {'debug-self-test', 'backend-self-test', 'synthetic noise maker'}

def read_submissions(book, sheet_name='submissions'):
    with zipfile.ZipFile(book) as z:
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(n.itertext()) for n in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('x:si', NS)]
        workbook = ET.fromstring(z.read('xl/workbook.xml'))
        prop = workbook.find('x:workbookPr', NS)
        if prop is not None and prop.get('date1904') in ('1', 'true'):
            raise ValueError('1904 workbook dates require explicit handling')
        sheet = next(s for s in workbook.findall('x:sheets/x:sheet', NS) if s.get('name') == sheet_name)
        rel_id = sheet.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        target = next(r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels')) if r.get('Id') == rel_id)
        target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
        rows = []
        for row in ET.fromstring(z.read(target)).findall('x:sheetData/x:row', NS):
            values = {}
            for cell in row.findall('x:c', NS):
                if cell.find('x:f', NS) is not None:
                    # Formulas in ignored name columns are irrelevant; imported columns are checked below.
                    formula = True
                else:
                    formula = False
                value = cell.find('x:v', NS)
                value = value.text if value is not None else ''
                kind = cell.get('t', 'n')
                if kind == 's': value = strings[int(value)]
                if kind == 'inlineStr': value = ''.join(cell.find('x:is', NS).itertext())
                values[re.sub(r'\d', '', cell.get('r'))] = (value or '', kind, formula)
            rows.append((int(row.get('r')), values))
        headers = {key: value[0] for key, value in rows[0][1].items() if value[0]}
        return [(number, {headers[k]: v for k, v in values.items() if k in headers}) for number, values in rows[1:] if any(v[0] for v in values.values())]

def timestamp(cell, offset):
    value, kind, formula = cell
    if formula: raise ValueError('Formula in imported timestamp')
    if kind == 'n':
        ms = int((Decimal(value) * 86400000).to_integral_value(rounding=ROUND_HALF_UP))
        dt = datetime(1899, 12, 30, tzinfo=offset) + timedelta(milliseconds=ms)
    else:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if dt.tzinfo is None: dt = dt.replace(tzinfo=offset)
    return dt.astimezone(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')

def normalise(book, offset):
    accepted, excluded, repairs, rejected = [], [], [], []
    aliases = {}
    for _, entry in read_submissions(book, 'users'):
        cookie = entry.get('magic_cookie', ('',))[0].strip().lower()
        alias = entry.get('user', ('',))[0].strip()
        if cookie and alias:
            if cookie in aliases and aliases[cookie] != alias: raise ValueError('Conflicting aliases in users sheet')
            aliases[cookie] = alias
    for number, row in read_submissions(book):
        def field(name, default=''):
            value, _, formula = row.get(name, (default, 's', False))
            if formula: raise ValueError('Formula in imported ' + name)
            return value.strip()
        try:
            source, event = field('source'), field('event_type')
            labels = {source, event}
            record_class = 'synthetic' if 'synthetic noise maker' in labels else 'test' if labels & TEST_SOURCES else 'activity'
            if source in EVENTS and event not in EVENTS:
                event, source = source, event
                repairs.append({'row': number, 'repair': 'source/event columns reversed'})
            elif not event:
                event = 'periodic'
                repairs.append({'row': number, 'repair': 'legacy absent event defaults to periodic'})
            if event not in EVENTS: raise ValueError('Unsupported event type')
            cookie = field('magic_cookie').lower()
            if not re.fullmatch('[a-f0-9]{16,64}', cookie): raise ValueError('Invalid profile identifier')
            counts = []
            for name in ('use_count_since_last_push', 'visited_site_count'):
                raw_count = field(name)
                if not raw_count and record_class != 'activity':
                    counts.append(None)
                    continue
                value = Decimal(raw_count)
                if value != value.to_integral_value() or not 0 <= value <= 2147483647: raise ValueError('Invalid count')
                counts.append(int(value))
            version = field('client_version')
            if len(version) > 32: raise ValueError('Invalid client version')
            payload = dict(submitted_at_utc=timestamp(row['submitted_at_utc'], offset), magic_cookie=cookie,
                use_count_since_last_push=counts[0], visited_site_count=counts[1], event_type=event, client_version=version)
            alias = aliases.get(cookie) or row.get('user', ('',))[0].strip()
            if len(alias)>80 or re.search(r'[\x00-\x1f\x7f-\x9f]',alias): raise ValueError('Invalid reporting alias')
            if alias: payload['reporting_alias'] = alias
            received = timestamp(row['received_at_utc'], offset)
            # Include original receipt time/class/source to preserve distinct source
            # records, even when accepted spreadsheet rows repeat the same payload.
            encoded = json.dumps([received, payload, record_class, source], separators=(',', ':'), ensure_ascii=False)
            payload['submission_id'] = hashlib.sha256(('google-sheets-import-v1:' + encoded).encode()).hexdigest()
            accepted.append({'row': number, 'received_at': received, 'record_class': record_class, 'legacy_source': source, 'reporting_alias':alias, 'payload': payload})
        except Exception as error:
            rejected.append({'row': number, 'reason': str(error)})
    return accepted, excluded, repairs, rejected

def sql_for(rows):
    def quote(value): return 'null' if value is None else "'" + str(value).replace("'", "''") + "'"
    values = []
    for r in rows:
        p = r['payload']
        values.append('(' + ','.join(quote(v) for v in [p['submission_id'], r['received_at'], p['submitted_at_utc'], p['magic_cookie'], p['use_count_since_last_push'], p['visited_site_count'], p['event_type'], p['client_version'], json.dumps(p, separators=(',', ':')), r['record_class'], r['legacy_source'], r['reporting_alias']]) + ')')
    if not values: raise ValueError('No valid rows to import')
    return """begin;
drop table if exists pg_temp.mwh_import_result;
set local standard_conforming_strings = on;
lock table public.usage_submissions in share row exclusive mode;
create temp table mwh_legacy_stage (like public.usage_submissions including defaults) on commit drop;
insert into mwh_legacy_stage values
""" + ',\n'.join(values) + """;
create temp table mwh_before on commit drop as select count(*)::int as notifications from public.new_profile_notifications;
do $$ begin
  if exists(select 1 from mwh_legacy_stage s join public.usage_submissions u using(submission_id)
    where s.payload <> u.payload or s.record_class <> u.record_class or s.legacy_source is distinct from u.legacy_source) then
    raise exception 'Historical receipt ID collision';
  end if;
end $$;
-- Baseline before inserts so historical profiles never cause new-user emails.
insert into public.known_usage_profiles(magic_cookie, first_received_at, reporting_alias)
select magic_cookie, min(received_at), max(reporting_alias) from mwh_legacy_stage group by magic_cookie
on conflict (magic_cookie) do update set first_received_at=least(public.known_usage_profiles.first_received_at, excluded.first_received_at),
 reporting_alias=case when public.known_usage_profiles.reporting_alias='' then excluded.reporting_alias else public.known_usage_profiles.reporting_alias end;
create temp table mwh_imported on commit drop as
with inserted as (
  insert into public.usage_submissions
  select distinct on (s.submission_id) s.* from mwh_legacy_stage s
  where not exists (select 1 from public.usage_submissions u
    where u.submission_id=s.submission_id or
      (lower(u.magic_cookie)=s.magic_cookie and u.received_at=s.received_at and u.record_class=s.record_class and u.submitted_at=s.submitted_at and u.use_count is not distinct from s.use_count
       and u.visited_count is not distinct from s.visited_count and u.event_type=s.event_type and u.client_version=s.client_version))
  order by s.submission_id,s.received_at
  on conflict (submission_id) do nothing returning submission_id
) select * from inserted;
do $$ begin
  assert (select count(*) from public.new_profile_notifications)=(select notifications from mwh_before), 'Import created a notification';
end $$;
create temp table mwh_import_result as select (select count(*) from mwh_legacy_stage) as prepared,
       (select count(*) from mwh_imported) as imported,
       (select count(*) from mwh_legacy_stage)-(select count(*) from mwh_imported) as already_present_or_duplicate,
       (select count(*) from public.new_profile_notifications)-(select notifications from mwh_before) as new_notifications;
commit;
select * from mwh_import_result;
"""

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook',type=Path)
    parser.add_argument('--utc-offset',required=True,help='Confirmed spreadsheet offset, for example +02:00')
    parser.add_argument('--output',type=Path,default=Path('.local/legacy-import'))
    args=parser.parse_args()
    if not re.fullmatch(r'[+-]\d{2}:\d{2}',args.utc_offset): parser.error('Expected explicit UTC offset')
    sign=1 if args.utc_offset[0]=='+' else -1
    offset=timezone(sign*timedelta(hours=int(args.utc_offset[1:3]),minutes=int(args.utc_offset[4:6])))
    rows,excluded,repairs,rejected=normalise(args.workbook,offset)
    args.output.mkdir(parents=True,exist_ok=True)
    original=args.workbook.read_bytes()
    shutil.copy2(args.workbook,args.output/'original.xlsx')
    audit={'source_sha256':hashlib.sha256(original).hexdigest(),'utc_offset':args.utc_offset,'prepared':len(rows),
        'profiles':len({r['payload']['magic_cookie'] for r in rows}),'excluded':excluded,'repairs':repairs,'rejected':rejected,
        'events':dict(Counter(r['payload']['event_type'] for r in rows)), 'classes':dict(Counter(r['record_class'] for r in rows)),
        'earliest_received':min((r['received_at'] for r in rows),default=None),'latest_received':max((r['received_at'] for r in rows),default=None)}
    (args.output/'audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf8')
    (args.output/'prepared.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf8')
    if rejected: raise SystemExit(f'{len(rejected)} rows need review; no SQL generated. See private audit.')
    (args.output/'import.sql').write_text(sql_for(rows),encoding='utf8')
    print(json.dumps({k:v for k,v in audit.items() if k not in ('excluded','repairs','rejected')}))
    print(f'All source classes retained; repaired legacy column/event layouts: {len(repairs)}. Prepared only; database unchanged.')
