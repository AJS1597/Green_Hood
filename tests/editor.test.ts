import { describe, expect, it } from 'vitest';
import { docToLevel, emptyDoc, docFromLevel, lineCells, rectCells } from '../src/editor/editor';

describe('editor bounding-box crop', () => {
  it('crops a sparse map to the smallest rectangle around its contents', () => {
    const doc = emptyDoc();
    doc.tiles.set('5,5', 8);
    doc.tiles.set('10,8', 28);
    doc.solids.add('5,5');
    doc.spawn = { col: 6, row: 6 };
    doc.goal = { col: 9, row: 7 };

    const level = docToLevel(doc);

    // Bounds span columns 5..10 and rows 5..8 => 6 x 4.
    expect(level.columns).toBe(6);
    expect(level.rows).toBe(4);
    // Contents and markers are shifted so the rectangle starts at (0, 0).
    expect(level.tiles[0]?.[0]).toBe(8);
    expect(level.tiles[3]?.[5]).toBe(28);
    expect(level.solids[0]?.[0]).toBe(true);
    expect(level.spawn).toEqual({ col: 1, row: 1 });
    expect(level.goal).toEqual({ col: 4, row: 2 });
  });

  it('keeps a single tile as a 1x1 map', () => {
    const doc = emptyDoc();
    doc.tiles.set('3,4', 41);
    doc.spawn = { col: 3, row: 4 };
    doc.goal = { col: 3, row: 4 };
    const level = docToLevel(doc);
    expect(level.columns).toBe(1);
    expect(level.rows).toBe(1);
    expect(level.tiles[0]?.[0]).toBe(41);
  });

  it('round-trips through docFromLevel', () => {
    const doc = emptyDoc();
    doc.tiles.set('2,2', 8);
    doc.tiles.set('7,3', 28);
    doc.solids.add('2,2');
    doc.spawn = { col: 2, row: 2 };
    doc.goal = { col: 7, row: 3 };

    const level = docToLevel(doc);
    const restored = docFromLevel(level);

    expect(restored.tiles.size).toBe(2);
    expect(restored.solids.size).toBe(1);
    // Restored coordinates are relative to the cropped rectangle's origin.
    expect(restored.tiles.get('0,0')).toBe(8);
    expect(restored.tiles.get('5,1')).toBe(28);
  });

  it('saves placed kings and includes them in the bounds', () => {
    const doc = emptyDoc();
    doc.tiles.set('5,5', 8);
    doc.spawn = { col: 5, row: 4 };
    doc.goal = { col: 5, row: 4 };
    doc.kings.set('9,7', 'king'); // far from the tiles, so it grows the box

    const level = docToLevel(doc);

    expect(level.columns).toBe(5); // cols 5..9
    expect(level.rows).toBe(4); // rows 4..7
    expect(level.enemies).toEqual([{ type: 'king', col: 4, row: 3 }]);

    const restored = docFromLevel(level);
    expect(restored.kings.get('4,3')).toBe('king');
  });
});

describe('line and box helpers', () => {
  it('draws a straight horizontal line', () => {
    const cells = lineCells({ col: 2, row: 3 }, { col: 6, row: 3 });
    expect(cells).toEqual([
      { col: 2, row: 3 },
      { col: 3, row: 3 },
      { col: 4, row: 3 },
      { col: 5, row: 3 },
      { col: 6, row: 3 },
    ]);
  });

  it('draws a diagonal line with one cell per step', () => {
    const cells = lineCells({ col: 0, row: 0 }, { col: 3, row: 3 });
    expect(cells).toHaveLength(4);
    expect(cells[0]).toEqual({ col: 0, row: 0 });
    expect(cells[3]).toEqual({ col: 3, row: 3 });
  });

  it('fills a rectangle regardless of corner order', () => {
    const cells = rectCells({ col: 1, row: 1 }, { col: 2, row: 2 });
    expect(cells).toHaveLength(4);
    expect(cells).toContainEqual({ col: 1, row: 1 });
    expect(cells).toContainEqual({ col: 2, row: 2 });
  });
});
