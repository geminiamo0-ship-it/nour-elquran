/** Minimal structural D1 binding used by this foundation; not a browser API. */
export interface D1Statement {
  first<T>(): Promise<T | null>;
}
export interface CoreDatabase {
  prepare(sql: string): D1Statement;
}
export interface Env {
  DB?: CoreDatabase;
}
