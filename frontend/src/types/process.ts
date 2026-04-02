export type ProcessInfo = {
  pid: number;
  name: string;
  cpu: number;
  mem: number;
  memRss: number;
  command: string;
};

export type ProcessSnapshot = {
  server_id: string;
  ts: number;
  processes: ProcessInfo[];
};

export type ContainerInfo = {
  id: string;
  name: string;
  image: string;
  state: string;
  cpu: number;
  memUsage: number;
  memLimit: number;
};

export type ContainerSnapshot = {
  server_id: string;
  ts: number;
  containers: ContainerInfo[];
};
