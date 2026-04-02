import { useServerStore } from "../store/serverStore";
import { useProcessStore } from "../store/processStore";

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function ProcessPanel() {
  const activeServerId = useServerStore((state) => state.activeServerId);
  const snapshot = useProcessStore((state) => state.processSnapshots[activeServerId]);
  const processes = snapshot?.processes ?? [];

  return (
    <div className="panel panel--table">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Processes</p>
          <h2 className="panel-title">Top CPU / Memory</h2>
        </div>
        <div className="panel-meta-badge">{processes.length} tracked</div>
      </div>

      {processes.length === 0 ? (
        <p className="empty-hint">수집 중...</p>
      ) : (
        <div className="table-wrap">
          <table className="metric-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>PID</th>
                <th>CPU</th>
                <th>MEM</th>
                <th>RSS</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((process) => (
                <tr key={`${process.pid}-${process.name}`}>
                  <td title={process.command}>{process.name}</td>
                  <td><span className="mono-pill">{process.pid}</span></td>
                  <td><span className="metric-chip metric-chip--cpu">{process.cpu.toFixed(1)}%</span></td>
                  <td><span className="metric-chip metric-chip--mem">{process.mem.toFixed(1)}%</span></td>
                  <td>{formatBytes(process.memRss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
