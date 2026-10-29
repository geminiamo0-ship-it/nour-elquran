/** Server-only structural D1 interface; no browser binding or credentials. */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
}
export interface CoreDatabase { prepare(sql: string): D1Statement; }
export interface Env {
  DB?: CoreDatabase;
  AUTH_ENABLED?: string;
  AUTH_SECRET?: string;
  AUTH_ORIGIN?: string;
  AUTH_LOCAL_DEV?: string;
}
