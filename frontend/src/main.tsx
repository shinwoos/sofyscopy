import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

// 저장된 테마를 앱 시작 전에 즉시 적용
// — 이렇게 하지 않으면 dark로 시작했다가 light로 바뀌는 깜빡임(FOUC) 발생
const savedTheme = localStorage.getItem("theme") ?? "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
