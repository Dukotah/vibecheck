import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULES, MODULE_IDS, MODULE_META, getModule, validateRegistry } from '../src/registry.js';
import { validateModule } from '../src/contract.js';

const EXPECTED_IDS = ['legal', 'accessibility', 'crawlers', 'sharepreview', 'docs'];

test('registry loads exactly 5 modules', () => {
  assert.equal(MODULES.length, 5);
});

test('registry exposes the 5 expected ids in order', () => {
  assert.deepEqual(MODULE_IDS, EXPECTED_IDS);
});

test('MODULE_META mirrors modules with order indices', () => {
  assert.equal(MODULE_META.length, 5);
  MODULE_META.forEach((m, i) => {
    assert.equal(m.order, i);
    assert.equal(typeof m.title, 'string');
    assert.equal(typeof m.tagline, 'string');
    assert.ok(m.title.length > 0);
    assert.ok(m.tagline.length > 0);
  });
});

test('getModule finds each module by id, undefined otherwise', () => {
  for (const id of EXPECTED_IDS) {
    assert.equal(getModule(id).id, id);
  }
  assert.equal(getModule('nope'), undefined);
});

test('every registered module satisfies the contract', () => {
  const report = validateRegistry();
  for (const id of EXPECTED_IDS) {
    assert.deepEqual(report[id], [], `${id} should have no contract problems`);
  }
});

test('validateModule directly reports no problems for each module', () => {
  for (const mod of MODULES) {
    assert.deepEqual(validateModule(mod), []);
  }
});

test('module ids are unique', () => {
  assert.equal(new Set(MODULE_IDS).size, MODULE_IDS.length);
});
