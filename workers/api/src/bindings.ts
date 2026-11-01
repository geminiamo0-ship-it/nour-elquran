/** Server-only structural D1 interface; no browser binding or credentials. */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ success: boolean; meta: { changes: number } }>;
}
export interface CoreDatabase { prepare(sql: string): D1Statement;
  /** Cloudflare D1 transactional batch; never emulate as sequential run(). */
  batch?(statements: D1Statement[]): Promise<Array<{success:boolean;meta:{changes:number}}>>;
}
import type {LessonRoomNamespace} from './classroom/lesson-room.ts';

export interface Env {
  LESSON_ROOMS?: LessonRoomNamespace;
  NOOR_ENVIRONMENT?: string;
  NOOR_DEV_OPEN?: string;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  DB?: CoreDatabase;
  /** Off by default: full DO->D1 live ink delivery requires a lesson-end fence. */
  NOOR_CUMULATIVE_INK_ENABLED?: string;
  /** Source lands disabled; enable only after signed Dev realtime acceptance. */
  NOOR_REALTIME_HINTS_ENABLED?: string;
  AUTH_ENABLED?: string;
  AUTH_SECRET?: string;
  AUTH_ORIGIN?: string;
  AUTH_LOCAL_DEV?: string;
}
