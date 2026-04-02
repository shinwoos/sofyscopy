import { useState } from "react";
import type { Server } from "../store/serverStore";

// ── 서버 추가 모달 ─────────────────────────────────────────────────────────────
// SSH 접속 정보를 입력해 원격 서버를 등록
// POST /api/servers → 백엔드에서 연결 테스트 후 성공 시 서버 등록
//
// 보안 메모:
//   비밀번호/개인키는 HTTPS 없이 전송 시 평문 노출 — 개인용 로컬 앱 전제

type Props = {
  onClose: () => void;
  onAdded: (server: Server) => void;
};

type AuthType = "password" | "key";

export function AddServerModal({ onClose, onAdded }: Props) {
  const [name,       setName]       = useState("");
  const [host,       setHost]       = useState("");
  const [port,       setPort]       = useState(22);
  const [username,   setUsername]   = useState("");
  const [authType,   setAuthType]   = useState<AuthType>("password");
  const [credential, setCredential] = useState("");
  const [useBastion, setUseBastion] = useState(false);
  const [bastionHost, setBastionHost] = useState("");
  const [bastionPort, setBastionPort] = useState(22);
  const [bastionUsername, setBastionUsername] = useState("");
  const [bastionAuthType, setBastionAuthType] = useState<AuthType>("password");
  const [bastionCredential, setBastionCredential] = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/servers", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          host,
          port,
          username,
          auth_type:  authType,
          credential,
          bastion: useBastion
            ? {
                enabled: true,
                host: bastionHost,
                port: bastionPort,
                username: bastionUsername,
                auth_type: bastionAuthType,
                credential: bastionCredential,
              }
            : undefined,
        }),
      });

      const body = await res.json() as Record<string, unknown>;

      if (!res.ok) {
        throw new Error((body.error as string) ?? "서버 추가 실패");
      }

      // 응답을 Server 타입으로 변환
      onAdded({
        id:       body.id       as string,
        name:     body.name     as string,
        host:     body.host     as string,
        port:     body.port     as number,
        username: body.username as string,
        status:   "online",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    // 오버레이 클릭 시 닫힘
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <h2 className="modal-title">서버 추가</h2>
          <button className="modal-close" onClick={onClose} aria-label="닫기">×</button>
        </div>

        <form className="modal-form" onSubmit={(e) => { void handleSubmit(e); }}>

          {/* 표시 이름 */}
          <div className="form-group">
            <label className="form-label">이름</label>
            <input
              className="form-input"
              type="text"
              placeholder="Prod Server 01"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* 호스트 + 포트 */}
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">호스트</label>
              <input
                className="form-input"
                type="text"
                placeholder="192.168.1.100"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{ width: 80 }}>
              <label className="form-label">포트</label>
              <input
                className="form-input"
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                min={1}
                max={65535}
                required
              />
            </div>
          </div>

          {/* 사용자 이름 */}
          <div className="form-group">
            <label className="form-label">사용자 이름</label>
            <input
              className="form-input"
              type="text"
              placeholder="ubuntu"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* 인증 방식 선택 */}
          <div className="form-group">
            <label className="form-label">인증 방식</label>
            <div className="auth-tabs">
              <button
                type="button"
                className={`auth-tab ${authType === "password" ? "auth-tab--active" : ""}`}
                onClick={() => setAuthType("password")}
              >
                비밀번호
              </button>
              <button
                type="button"
                className={`auth-tab ${authType === "key" ? "auth-tab--active" : ""}`}
                onClick={() => setAuthType("key")}
              >
                개인키
              </button>
            </div>
          </div>

          {/* 비밀번호 또는 개인키 입력 */}
          <div className="form-group">
            {authType === "password" ? (
              <>
                <label className="form-label">비밀번호</label>
                <input
                  className="form-input"
                  type="password"
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  required
                />
              </>
            ) : (
              <>
                <label className="form-label">개인키 (PEM)</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder={"-----BEGIN RSA PRIVATE KEY-----\n..."}
                  value={credential}
                  onChange={(e) => setCredential(e.target.value)}
                  rows={6}
                  required
                />
              </>
            )}
          </div>

          <div className="form-group">
            <span className="form-label">점프 호스트</span>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={useBastion}
                onChange={(e) => setUseBastion(e.target.checked)}
              />
              배스천/Jump Host 사용
            </label>
          </div>

          {useBastion && (
            <>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">배스천 호스트</label>
                  <input
                    className="form-input"
                    type="text"
                    placeholder="10.0.0.10"
                    value={bastionHost}
                    onChange={(e) => setBastionHost(e.target.value)}
                    required={useBastion}
                  />
                </div>
                <div className="form-group" style={{ width: 80 }}>
                  <label className="form-label">배스천 포트</label>
                  <input
                    className="form-input"
                    type="number"
                    value={bastionPort}
                    onChange={(e) => setBastionPort(Number(e.target.value))}
                    min={1}
                    max={65535}
                    required={useBastion}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">배스천 사용자 이름</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="ubuntu"
                  value={bastionUsername}
                  onChange={(e) => setBastionUsername(e.target.value)}
                  required={useBastion}
                />
              </div>

              <div className="form-group">
                <label className="form-label">배스천 인증 방식</label>
                <div className="auth-tabs">
                  <button
                    type="button"
                    className={`auth-tab ${bastionAuthType === "password" ? "auth-tab--active" : ""}`}
                    onClick={() => setBastionAuthType("password")}
                  >
                    비밀번호
                  </button>
                  <button
                    type="button"
                    className={`auth-tab ${bastionAuthType === "key" ? "auth-tab--active" : ""}`}
                    onClick={() => setBastionAuthType("key")}
                  >
                    개인키
                  </button>
                </div>
              </div>

              <div className="form-group">
                {bastionAuthType === "password" ? (
                  <>
                    <label className="form-label">배스천 비밀번호</label>
                    <input
                      className="form-input"
                      type="password"
                      value={bastionCredential}
                      onChange={(e) => setBastionCredential(e.target.value)}
                      required={useBastion}
                    />
                  </>
                ) : (
                  <>
                    <label className="form-label">배스천 개인키 (PEM)</label>
                    <textarea
                      className="form-input form-textarea"
                      placeholder={"-----BEGIN RSA PRIVATE KEY-----\n..."}
                      value={bastionCredential}
                      onChange={(e) => setBastionCredential(e.target.value)}
                      rows={6}
                      required={useBastion}
                    />
                  </>
                )}
              </div>
            </>
          )}

          {/* 오류 메시지 */}
          {error && <p className="form-error">{error}</p>}

          {/* 버튼 */}
          <div className="modal-actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "연결 중..." : "연결"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
