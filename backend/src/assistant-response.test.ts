import test from 'node:test';
import assert from 'node:assert/strict';

import { inferBreakdownDimension } from './assistant-response.js';

test('compare prompt with explicit years keeps time-series (no breakdown)', () => {
  const dimension = inferBreakdownDimension('Compare 2019 to 2024');
  assert.equal(dimension, undefined);
});

test('sex comparison still infers sex breakdown', () => {
  const dimension = inferBreakdownDimension('Compare male vs female trends');
  assert.equal(dimension, 'sex');
});

test('explicit age breakdown wording infers age', () => {
  const dimension = inferBreakdownDimension('Show an age breakdown');
  assert.equal(dimension, 'age');
});
