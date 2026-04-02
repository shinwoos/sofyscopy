import { Elysia, t } from "elysia";
import { getRecentLogs } from "../services/logs.service";
import type { LogQuery } from "../types/log";

const logsQuerySchema = t.Object({
  server_id: t.String({ minLength: 1, default: "local" }),
  source: t.Union([t.Literal("file"), t.Literal("journal"), t.Literal("docker")]),
  target: t.Optional(t.String()),
  lines: t.Numeric({ minimum: 1, maximum: 1000, default: 100 }),
});

export const logsRoute = new Elysia({ prefix: "/api/logs" }).get(
  "/recent",
  async ({ query, set }) => {
    try {
      return await getRecentLogs(query as LogQuery);
    } catch (error) {
      set.status = 400;
      return {
        ok: false,
        error: error instanceof Error ? error.message : "로그 조회 실패",
      };
    }
  },
  {
    query: logsQuerySchema,
  },
);
