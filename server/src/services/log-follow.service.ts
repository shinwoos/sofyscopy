import { buildFollowLogCommand, resolveLogQuery } from "./logs.service";
import { execStreaming } from "../ssh/connection.manager";
import type { LogFollowClientMessage, LogQuery } from "../types/log";

type FollowClient = {
  send(data: string): unknown;
};

type FollowSession = {
  stop: () => void;
  carry: string;
};

const sessions = new Map<FollowClient, FollowSession>();
const LOCAL_FOLLOW_TIMEOUT_MS = 60 * 60 * 1000;
const MAX_FOLLOW_LINES = 2000;

function emit(client: FollowClient, payload: Record<string, unknown>) {
  client.send(JSON.stringify(payload));
}

function flushLines(client: FollowClient, session: FollowSession, chunk: string) {
  const merged = `${session.carry}${chunk}`;
  const parts = merged.split(/\r?\n/);
  session.carry = parts.pop() ?? "";

  const lines = parts
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0)
    .slice(-MAX_FOLLOW_LINES);

  if (lines.length > 0) {
    emit(client, { type: "log_follow_chunk", lines });
  }
}

function flushCarry(client: FollowClient, session: FollowSession) {
  const line = session.carry.trimEnd();
  session.carry = "";

  if (line) {
    emit(client, { type: "log_follow_chunk", lines: [line] });
  }
}

async function pumpStream(
  stream: ReadableStream<Uint8Array> | null | undefined,
  onChunk: (chunk: string) => void,
) {
  if (!stream) {
    return;
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      onChunk(decoder.decode(value, { stream: true }));
    }

    const tail = decoder.decode();
    if (tail) {
      onChunk(tail);
    }
  } finally {
    reader.releaseLock();
  }
}

function stopSession(client: FollowClient, reason = "client_stop") {
  const session = sessions.get(client);
  if (!session) {
    return;
  }

  sessions.delete(client);
  flushCarry(client, session);
  session.stop();
  emit(client, { type: "log_follow_stopped", reason });
}

async function startLocalFollow(client: FollowClient, query: LogQuery) {
  const command = buildFollowLogCommand(resolveLogQuery(query));
  const process = Bun.spawn({
    cmd: ["bash", "-lc", command],
    stdout: "pipe",
    stderr: "pipe",
  });

  const session: FollowSession = {
    carry: "",
    stop: () => {
      process.kill();
    },
  };

  sessions.set(client, session);

  const timeout = setTimeout(() => {
    if (sessions.get(client) === session) {
      emit(client, { type: "log_follow_error", message: "follow 세션 시간이 초과되었습니다" });
      stopSession(client, "timeout");
    }
  }, LOCAL_FOLLOW_TIMEOUT_MS);

  emit(client, { type: "log_follow_started" });

  try {
    await Promise.all([
      pumpStream(process.stdout, (chunk) => flushLines(client, session, chunk)),
      pumpStream(process.stderr, (chunk) => flushLines(client, session, chunk)),
      process.exited.then((code) => {
        if (sessions.get(client) !== session) {
          return;
        }

        if (code !== 0) {
          emit(client, { type: "log_follow_error", message: "로그 follow 실행이 종료되었습니다" });
        }

        stopSession(client, "stream_end");
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function startRemoteFollow(client: FollowClient, query: LogQuery) {
  const resolved = resolveLogQuery(query);
  const command = buildFollowLogCommand(resolved);

  const session: FollowSession = {
    carry: "",
    stop: () => {},
  };

  sessions.set(client, session);
  emit(client, { type: "log_follow_started" });

  try {
    const streaming = await execStreaming(resolved.server_id, command, {
      onStdout: (chunk) => {
        if (sessions.get(client) === session) {
          flushLines(client, session, chunk);
        }
      },
      onStderr: (chunk) => {
        if (sessions.get(client) === session) {
          flushLines(client, session, chunk);
        }
      },
      onClose: (code) => {
        if (sessions.get(client) !== session) {
          return;
        }

        if (code !== 0) {
          emit(client, { type: "log_follow_error", message: "원격 follow 세션이 종료되었습니다" });
        }

        stopSession(client, "stream_end");
      },
      onError: (error) => {
        if (sessions.get(client) !== session) {
          return;
        }

        emit(client, { type: "log_follow_error", message: error.message });
        stopSession(client, "error");
      },
    });

    session.stop = streaming.stop;
  } catch (error) {
    sessions.delete(client);
    emit(client, {
      type: "log_follow_error",
      message: error instanceof Error ? error.message : "로그 follow 시작 실패",
    });
  }
}

export async function handleLogFollowMessage(client: FollowClient, message: LogFollowClientMessage) {
  if (message.type === "log_follow_stop") {
    stopSession(client);
    return;
  }

  stopSession(client);

  if (message.query.server_id === "local") {
    await startLocalFollow(client, message.query);
    return;
  }

  await startRemoteFollow(client, message.query);
}

export function cleanupLogFollow(client: FollowClient) {
  stopSession(client, "disconnect");
}
