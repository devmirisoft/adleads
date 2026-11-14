import { describe, expect, it } from 'vitest';
import { pieSlices } from '../../src/modules/core/components/PieChart';

const s = (label: string, value: number) => ({ label, value });

describe('pieSlices', () => {
  it('sorts largest first and drops zeros', () => {
    expect(pieSlices([s('a', 1), s('b', 0), s('c', 5)])).toEqual([s('c', 5), s('a', 1)]);
  });

  it('keeps 5 parts as-is and folds the tail past 5 into Other', () => {
    const five = [1, 2, 3, 4, 5].map((v) => s(`b${v}`, v));
    expect(pieSlices(five)).toHaveLength(5);
    const seven = [...five, s('b6', 6), s('b7', 7)];
    expect(pieSlices(seven, 'Other batches')).toEqual([
      s('b7', 7),
      s('b6', 6),
      s('b5', 5),
      s('b4', 4),
      s('b3', 3),
      s('Other batches', 3),
    ]);
  });
});
