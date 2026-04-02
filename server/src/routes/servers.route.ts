import { Elysia, t } from "elysia";
import {
  listServers,
  registerServer,
  removeServerById,
  testServerConnection,
} from "../services/servers.service";
import type { AddServerRequest } from "../types/server";

const bastionSchema = t.Optional(
  t.Object({
    enabled: t.Boolean(),
    host: t.String({ minLength: 1 }),
    port: t.Number({ minimum: 1, maximum: 65535 }),
    username: t.String({ minLength: 1 }),
    auth_type: t.Union([t.Literal("password"), t.Literal("key")]),
    credential: t.String({ minLength: 1 }),
  }),
);

const addServerSchema = t.Object({
  name:       t.String({ minLength: 1 }),
  host:       t.String({ minLength: 1 }),
  port:       t.Number({ minimum: 1, maximum: 65535 }),
  username:   t.String({ minLength: 1 }),
  auth_type:  t.Union([t.Literal("password"), t.Literal("key")]),
  credential: t.String({ minLength: 1 }),
  bastion: bastionSchema,
});

// ── 서버 관리 라우트 ───────────────────────────────────────────────────────────
// GET    /api/servers           — 서버 목록 조회 (credential 필드 제외)
// POST   /api/servers           — 서버 추가 + SSH 연결 테스트
// DELETE /api/servers/:id       — 서버 삭제 (로컬 서버 삭제 불가)

export const serversRoute = new Elysia({ prefix: "/api/servers" })

  // 전체 서버 목록 — credential 제외
  .get("/", () => {
    return listServers();
  })

  // 저장 없이 SSH 연결만 테스트
  .post(
    "/test",
    async ({ body, set }) => {
      const result = await testServerConnection(body as AddServerRequest);

      if (!result.ok) {
        set.status = 400;
      }

      return result;
    },
    {
      body: addServerSchema,
    },
  )

  // 서버 추가
  .post(
    "/",
    async ({ body, set }) => {
      try {
        return await registerServer(body as AddServerRequest);
      } catch (error) {
        set.status = 400;
        return {
          error: error instanceof Error ? error.message : "SSH 연결 실패",
        };
      }
    },
    {
      body: addServerSchema,
    },
  )

  // 서버 삭제
  .delete("/:id", ({ params, set }) => {
    try {
      removeServerById(params.id);
      return { ok: true };
    } catch (error) {
      set.status =
        error instanceof Error && error.message === "서버를 찾을 수 없습니다"
          ? 404
          : 400;
      return {
        error: error instanceof Error ? error.message : "서버 삭제 실패",
      };
    }
  });
