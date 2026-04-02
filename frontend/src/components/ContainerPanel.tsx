import { useServerStore } from "../store/serverStore";
import { useProcessStore } from "../store/processStore";

function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function ContainerPanel() {
  const activeServerId = useServerStore((state) => state.activeServerId);
  const snapshot = useProcessStore((state) => state.containerSnapshots[activeServerId]);
  const containers = snapshot?.containers ?? [];

  return (
    <div className="panel panel--table">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Containers</p>
          <h2 className="panel-title">Docker Runtime</h2>
        </div>
        <div className="panel-meta-badge">{containers.length} active</div>
      </div>

      {containers.length === 0 ? (
        <p className="empty-hint">컨테이너가 없거나 수집 중...</p>
      ) : (
        <div className="table-wrap">
          <table className="metric-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>State</th>
                <th>CPU</th>
                <th>Usage</th>
                <th>Limit</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((container) => (
                <tr key={container.id}>
                  <td title={container.image}>{container.name}</td>
                  <td><span className={`state-pill state-pill--${container.state.toLowerCase()}`}>{container.state}</span></td>
                  <td><span className="metric-chip metric-chip--cpu">{container.cpu.toFixed(1)}%</span></td>
                  <td>{formatBytes(container.memUsage)}</td>
                  <td>{container.memLimit > 0 ? formatBytes(container.memLimit) : "unlimited"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
