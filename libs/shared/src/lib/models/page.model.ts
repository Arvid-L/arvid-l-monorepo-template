// The list-endpoint convention: FE sends PageRequest params, API answers
// PageResponse. page is 1-based. sort keys are camelCase model fields the
// endpoint explicitly whitelists (see resolveSort in the API).
export interface PageRequest {
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PageResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
