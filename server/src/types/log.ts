export type LogSourceType = "file" | "journal" | "docker";

export type LogQuery = {
  server_id: string;
  source: LogSourceType;
  target?: string;
  lines: number;
};

export type LogEntry = {
  line_number: number;
  text: string;
};

export type LogResult = {
  ok: true;
  server_id: string;
  source: LogSourceType;
  target: string | null;
  lines_requested: number;
  lines: LogEntry[];
};

export type ResolvedLogQuery = {
  server_id: string;
  source: LogSourceType;
  target?: string;
  lines: number;
};

export type LogFollowStartMessage = {
  type: "log_follow_start";
  query: LogQuery;
};

export type LogFollowStopMessage = {
  type: "log_follow_stop";
};

export type LogFollowClientMessage =
  | LogFollowStartMessage
  | LogFollowStopMessage;
