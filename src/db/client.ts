import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy初期化:
//   import時ではなく最初に db.xxx() を呼んだ瞬間に初期化する。
//   これにより DATABASE_URL 未設定でもビルドや SSR レンダリング自体は通り、
//   呼び出し側の try/catch で「DB未接続」フォールバックUIを出せる。

type DB = NeonHttpDatabase<typeof schema>;

let cached: DB | null = null;

function init(): DB {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  cached = drizzle(neon(url), { schema });
  return cached;
}

export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = init() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(real, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

export type { DB };
