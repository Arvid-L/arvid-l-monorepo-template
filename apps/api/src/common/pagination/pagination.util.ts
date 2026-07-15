import { PageRequest, PageResponse } from '@arvid-l-monorepo-template/shared';

export const pageOffset = (
  query: Pick<PageRequest, 'page' | 'pageSize'>,
): number => (query.page - 1) * query.pageSize;

export const toPageResponse = <T>(
  items: T[],
  total: number,
  query: Pick<PageRequest, 'page' | 'pageSize'>,
): PageResponse<T> => ({
  items,
  total,
  page: query.page,
  pageSize: query.pageSize,
});

// Maps a client-provided camelCase sort key to a real column name via an
// endpoint-owned whitelist. NEVER feed raw client input into orderBy —
// this is the injection guard.
export const resolveSort = (
  columns: Record<string, string>,
  sort: string | undefined,
  fallback: string,
): string => (sort && columns[sort]) || fallback;
