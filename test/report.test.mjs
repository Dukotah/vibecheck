import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, toMarkdown } from '../src/report.js';

const entry = (id, result) => ({ id, title: id.toUpperCase(), result });
const NOW = new Date('2026-08-24T00:00:00.000Z');

test('buildReport on empty input has overall + no sections', () => {
  const r = buildReport([], { now: NOW });
  assert.equal(r.title, 'VibeCheck — Launch Readiness Report');
  assert.equal(r.generatedAt, NOW.toISOString());
  assert.equal(r.overall.status, 'incomplete');
  assert.deepEqual(r.sections, []);
});

test('buildReport maps each entry to a section with statusWord', () => {
  const r = buildReport(
    [
      entry('a', { status: 'pass', score: 90, summary: 'ok', findings: [], fixes: [] }),
      entry('b', { status: 'fail', score: 0, summary: 'bad', findings: [], fixes: [] }),
    ],
    { now: NOW },
  );
  assert.equal(r.sections.length, 2);
  assert.equal(r.sections[0].statusWord, 'Passed');
  assert.equal(r.sections[1].statusWord, 'Failed');
  assert.equal(r.sections[1].summary, 'bad');
});

test('buildReport defaults generatedAt to a valid ISO string', () => {
  const r = buildReport([]);
  assert.ok(!Number.isNaN(Date.parse(r.generatedAt)));
});

test('toMarkdown renders a title and score line', () => {
  const md = toMarkdown(buildReport([entry('a', { status: 'pass', score: 100, summary: 's', findings: [], fixes: [] })], { now: NOW }));
  assert.match(md, /# VibeCheck — Launch Readiness Report/);
  assert.match(md, /Launch Readiness: 100\/100/);
});

test('toMarkdown includes section headings and findings', () => {
  const md = toMarkdown(
    buildReport(
      [
        entry('a', {
          status: 'warn',
          score: 50,
          summary: 'watch out',
          findings: [
            { level: 'good', text: 'has license' },
            { level: 'bad', text: 'no readme' },
          ],
          fixes: [{ label: 'add a readme', copyText: '# Title' }],
        }),
      ],
      { now: NOW },
    ),
  );
  assert.match(md, /## .*A — Needs a look \(50\/100\)/);
  assert.match(md, /has license/);
  assert.match(md, /no readme/);
  assert.match(md, /\*\*Fixes:\*\*/);
});

test('toMarkdown renders the prioritized fix list', () => {
  const md = toMarkdown(
    buildReport(
      [
        entry('a', { status: 'fail', score: 0, summary: '', findings: [], fixes: [{ label: 'fix one', copyText: '' }] }),
      ],
      { now: NOW },
    ),
  );
  assert.match(md, /## Prioritized fix list/);
  assert.match(md, /1\. \*\*A\*\* — fix one/);
});

test('toMarkdown of a null report is an empty string', () => {
  assert.equal(toMarkdown(null), '');
});

test('toMarkdown reports how many checks were run', () => {
  const md = toMarkdown(
    buildReport(
      [
        entry('a', { status: 'pass', score: 100, summary: '', findings: [], fixes: [] }),
        entry('b', { status: 'incomplete', score: 0, summary: '', findings: [], fixes: [] }),
      ],
      { now: NOW },
    ),
  );
  assert.match(md, /1 of 2 checks run/);
});
