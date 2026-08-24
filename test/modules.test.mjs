import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES } from '../src/registry.js';
import { STATUSES } from '../src/contract.js';

for (const mod of MODULES) {
  test(`[${mod.id}] has string id/title/tagline`, () => {
    assert.equal(typeof mod.id, 'string');
    assert.equal(typeof mod.title, 'string');
    assert.equal(typeof mod.tagline, 'string');
    assert.ok(mod.id.length && mod.title.length && mod.tagline.length);
  });

  test(`[${mod.id}] run() returns a valid incomplete stub result`, () => {
    const r = mod.run(undefined);
    assert.ok(STATUSES.includes(r.status));
    assert.equal(r.status, 'incomplete');
    assert.equal(r.score, 0);
    assert.equal(typeof r.summary, 'string');
    assert.ok(r.summary.length > 0);
    assert.deepEqual(r.findings, []);
    assert.deepEqual(r.fixes, []);
  });

  test(`[${mod.id}] run() tolerates arbitrary input without throwing`, () => {
    assert.doesNotThrow(() => mod.run({ anything: true }));
    assert.doesNotThrow(() => mod.run(null));
    assert.doesNotThrow(() => mod.run('string'));
  });

  test(`[${mod.id}] formSpec() returns fields[] and examples[]`, () => {
    const spec = mod.formSpec();
    assert.ok(Array.isArray(spec.fields));
    assert.ok(Array.isArray(spec.examples));
    assert.ok(spec.fields.length >= 1, 'each module should collect at least one input');
    for (const f of spec.fields) {
      assert.equal(typeof f.name, 'string');
      assert.equal(typeof f.label, 'string');
      assert.equal(typeof f.type, 'string');
    }
  });

  test(`[${mod.id}] formSpec() examples reference real field names`, () => {
    const spec = mod.formSpec();
    const names = new Set(spec.fields.map((f) => f.name));
    for (const ex of spec.examples) {
      assert.equal(typeof ex.label, 'string');
      assert.equal(typeof ex.value, 'object');
      for (const key of Object.keys(ex.value)) {
        assert.ok(names.has(key), `${mod.id} example uses unknown field ${key}`);
      }
    }
  });
}
