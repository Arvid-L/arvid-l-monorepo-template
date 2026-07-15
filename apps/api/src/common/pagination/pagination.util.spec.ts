import { pageOffset, resolveSort, toPageResponse } from './pagination.util';

describe('pagination utils', () => {
  it('computes offsets from 1-based pages', () => {
    expect(pageOffset({ page: 1, pageSize: 20 })).toBe(0);
    expect(pageOffset({ page: 3, pageSize: 10 })).toBe(20);
  });

  it('wraps items in a page response', () => {
    expect(toPageResponse(['a'], 41, { page: 2, pageSize: 20 })).toEqual({
      items: ['a'],
      total: 41,
      page: 2,
      pageSize: 20,
    });
  });

  it('resolves sort keys against the whitelist only', () => {
    const columns = { createdAt: 'created_at' };
    expect(resolveSort(columns, 'createdAt', 'name')).toBe('created_at');
    expect(resolveSort(columns, 'evil; drop table', 'name')).toBe('name');
    expect(resolveSort(columns, undefined, 'name')).toBe('name');
  });

  it('ignores prototype-chain keys that are not own whitelist entries', () => {
    const columns = { createdAt: 'created_at' };
    expect(resolveSort(columns, 'constructor', 'name')).toBe('name');
    expect(resolveSort(columns, 'hasOwnProperty', 'name')).toBe('name');
    expect(resolveSort(columns, 'toString', 'name')).toBe('name');
  });
});
