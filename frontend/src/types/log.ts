export type LogSourceType = "file" | "journal" | "docker";

export type LogEntry = {
  line_number: number;
  text: string;
};

export type LogResponse = {
  ok: true;
  server_id: string;
  source: LogSourceType;
  target: string | null;
  lines_requested: number;
  lines: LogEntry[];
};

export type LogFollowChunkMessage = {
  type: "log_follow_chunk";
  lines: string[];
};

export type LogFollowStartedMessage = {
  type: "log_follow_started";
};

export type LogFollowStoppedMessage = {
  type: "log_follow_stopped";
  reason: string;
};

export type LogFollowErrorMessage = {
  type: "log_follow_error";
  message: string;
};

export type LogWsMessage =
  | { type: "connected"; message: string }
  | LogFollowChunkMessage
  | LogFollowStartedMessage
  | LogFollowStoppedMessage
  | LogFollowErrorMessage;
