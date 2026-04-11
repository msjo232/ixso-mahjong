"use client";

import { useEffect, useState } from "react";

const API_URL = "/api/mahjong";

type Schedule = {
  id: string;
  nickname: string;
  start: string;
  end: string;
  table: string;
};

type Block = {
  id: string;
  title: string;
  start: string;
  end: string;
  scope: string;
};

export default function Page() {
  const [date, setDate] = useState("2026-04-11");
  const [message, setMessage] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);

  const START = 6; // 06:00 시작
  const HOURS = 24;

  const handleResponse = (res: any, onSuccess: (data: any) => void) => {
    if (!res.success) {
      setMessage(res.message || "오류");
      return;
    }
    setMessage("");
    onSuccess(res);
  };

  const loadSchedules = async () => {
    const res = await fetch(`${API_URL}?action=schedules&date=${date}`);
    const data = await res.json();
    handleResponse(data, (res) => setSchedules(res.schedules || []));
  };

  const loadBlocks = async () => {
    const res = await fetch(`${API_URL}?action=blocks&date=${date}`);
    const data = await res.json();
    handleResponse(data, (res) => setBlocks(res.blocks || []));
  };

  useEffect(() => {
    loadSchedules();
    loadBlocks();
  }, [date]);

  // 시간 → 숫자 변환
  const timeToPos = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    let hour = h;
    if (hour < START) hour += 24;
    return hour + m / 60;
  };

  const renderBars = () => {
    const items: any[] = [];

    schedules.forEach((s) => {
      items.push({
        ...s,
        type: "schedule",
        color: s.table === "1탁" ? "#2e7d32" : "#1565c0",
      });
    });

    blocks.forEach((b) => {
      items.push({
        ...b,
        type: "block",
        color: "#6a1b9a",
      });
    });

    return items.map((item, idx) => {
      const start = timeToPos(item.start);
      const end = timeToPos(item.end);

      const left = ((start - START) / HOURS) * 100;
      const width = ((end - start) / HOURS) * 100;

      return (
        <div
          key={idx}
          style={{
            position: "absolute",
            left: `${left}%`,
            width: `${width}%`,
            top: `${idx * 28}px`,
            height: 24,
            borderRadius: 8,
            background: item.color,
            color: "white",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
          }}
        >
          {item.type === "schedule"
            ? item.nickname
            : `🚧 ${item.title}`}
        </div>
      );
    });
  };

  const renderTimeLabels = () => {
    const labels = [];
    for (let i = 0; i <= 24; i++) {
      const h = (START + i) % 24;
      labels.push(
        <div key={i} style={{ flex: 1, fontSize: 10, textAlign: "center" }}>
          {h.toString().padStart(2, "0")}
        </div>
      );
    }
    return labels;
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>익쏘 마작 타임라인</h2>

      {message && (
        <div style={{ color: "red", marginBottom: 10 }}>{message}</div>
      )}

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {/* 타임라인 */}
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex" }}>{renderTimeLabels()}</div>

        <div
          style={{
            position: "relative",
            height: 200,
            border: "1px solid #ddd",
            marginTop: 5,
          }}
        >
          {renderBars()}
        </div>
      </div>
    </div>
  );
}
