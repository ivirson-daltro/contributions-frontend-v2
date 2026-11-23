export interface PagedOptions<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number };
}
