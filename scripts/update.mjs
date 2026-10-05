// Keeps data/data.json tidy. Runs in GitHub Actions (daily and on every data change)
// and locally with: node scripts/update.mjs
//
// What it does:
//   1. Validates the data and fails loudly if something is malformed.
//   2. Moves old items (events and deadlines that ended 14+ days ago, activity
//      beyond the newest 40) into data/archive.json so the dashboard stays small.
//   3. Refreshes the counts in stats.summary.
//   4. Sets meta.updatedAt only when something actually changed, so a quiet day
//      produces no commit.
//
// Anything that depends on "today" (days left, next lesson, this week) is worked
// out in the browser, so the page is always current without a rebuild.

import fs from 'node:fs';

const DATA = 'data/data.json';
const ARCHIVE = 'data/archive.json';
const KEEP_DAYS = 14;
const KEEP_ACTIVITY = 40;
const STATUSES = ['applied', 'tests', 'video', 'ac', 'final', 'offer', 'rejected', 'withdrawn'];
const KINDS = ['shift', 'lecture', 'seminar', 'driving'];

const read = (p, fallback) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback);
const write = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n');
const when = (s) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; };

const data = read(DATA);
if (!data) { console.error(`Missing ${DATA}`); process.exit(1); }
const archive = read(ARCHIVE, { events: [], deadlines: [], activity: [] });
for (const k of ['events', 'deadlines', 'activity']) archive[k] ||= [];

const fingerprint = () => JSON.stringify({ ...data, meta: undefined });
const before = fingerprint();
const archiveBefore = JSON.stringify(archive);

// 1. Validate ---------------------------------------------------------------
const errors = [];
const ids = new Set();
const need = (cond, msg) => { if (!cond) errors.push(msg); };
const section = (name, rows, check) => {
  need(Array.isArray(rows), `${name} must be a list`);
  (rows || []).forEach((r, i) => {
    const tag = `${name}[${i}]${r?.id ? ` (${r.id})` : ''}`;
    need(r && typeof r.id === 'string' && r.id, `${tag}: missing id`);
    const key = `${name}/${r?.id}`;
    need(!ids.has(key), `${tag}: duplicate id`);
    ids.add(key);
    check(r, tag);
  });
};

section('applications', data.applications, (a, t) => {
  need(a.company, `${t}: missing company`);
  need(STATUSES.includes(a.status), `${t}: status "${a.status}" is not one of ${STATUSES.join(', ')}`);
  if (a.appliedOn) need(when(a.appliedOn), `${t}: appliedOn is not a date`);
  if (a.rejectedOn) need(when(a.rejectedOn), `${t}: rejectedOn is not a date`);
});
section('events', data.events, (e, t) => {
  need(KINDS.includes(e.kind), `${t}: kind "${e.kind}" is not one of ${KINDS.join(', ')}`);
  need(e.title, `${t}: missing title`);
  need(when(e.start), `${t}: start is not a date`);
  need(when(e.end || e.start), `${t}: end is not a date`);
  if (e.end && when(e.start) && when(e.end)) need(when(e.end) >= when(e.start), `${t}: ends before it starts`);
});
section('deadlines', data.deadlines, (d, t) => {
  need(d.title, `${t}: missing title`);
  need(when(d.due), `${t}: due is not a date`);
});
section('research', data.research, (r, t) => need(r.title, `${t}: missing title`));
section('activity', data.activity, (a, t) => {
  need(a.text, `${t}: missing text`);
  need(when(a.at), `${t}: at is not a date`);
});

if (errors.length) {
  console.error('data/data.json has problems:\n- ' + errors.join('\n- '));
  process.exit(1);
}

// 2. Archive old items ------------------------------------------------------
const cutoff = new Date(Date.now() - KEEP_DAYS * 864e5);
const move = (name, isOld) => {
  const keep = [];
  for (const row of data[name]) {
    if (isOld(row)) {
      if (!archive[name].some((x) => x.id === row.id)) archive[name].push(row);
    } else keep.push(row);
  }
  data[name] = keep;
};
move('events', (e) => (when(e.end || e.start) ?? new Date()) < cutoff);
move('deadlines', (d) => when(d.due) < cutoff);

data.activity.sort((a, b) => String(b.at).localeCompare(String(a.at)));
for (const row of data.activity.splice(KEEP_ACTIVITY)) {
  if (!archive.activity.some((x) => x.id === row.id)) archive.activity.push(row);
}

// 3. Counts -----------------------------------------------------------------
const byStatus = {};
for (const a of data.applications) byStatus[a.status] = (byStatus[a.status] || 0) + 1;
data.stats ||= {};
data.stats.summary = {
  applications: data.applications.length,
  rejected: byStatus.rejected || 0,
  open: data.applications.filter((a) => !['rejected', 'withdrawn'].includes(a.status)).length,
  byStatus,
};

// 4. Stamp only on change ---------------------------------------------------
const changed = fingerprint() !== before;
if (changed) data.meta = { ...(data.meta || {}), updatedAt: new Date().toISOString() };
if (changed || JSON.stringify(data) !== JSON.stringify(read(DATA))) write(DATA, data);
if (JSON.stringify(archive) !== archiveBefore) write(ARCHIVE, archive);

console.log(
  changed
    ? `Updated: ${data.applications.length} applications, ${data.events.length} events, ${data.deadlines.length} deadlines.`
    : 'No changes.'
);
