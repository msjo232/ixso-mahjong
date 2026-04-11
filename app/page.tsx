"use client";

import { useEffect, useState } from "react";

const API_URL = "/api/mahjong";

type Member = {
  nickname: string;
  name: string;
};

type Schedule = {
  id: string;
  nickname: string;
  date: string;
  start: string;
  end: string;
  table: string;
};

type Block = {
  id: string;
  title: string;
  date: string;
  start: string;
  end: string;
  scope: string;
  type: string;
};

export default function Page() {
  const [message, setMessage] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [date, setDate] = useState("2026-04-11");

  // ✅ 공통 응답 처리
  const handleResponse = (res: any, onSuccess: (data: any) => void) => {
    if (!res.success) {
      setMessage(res.message || "오류 발생");
      return;
    }

    // 성공하면 메시지 제거
    setMessage("");
    onSuccess(res);
  };

  // 🔹 회원
  const loadMembers = async () => {
    const res = await fetch(`${API_URL}?action=members`);
    const data = await res.json();

    handleResponse(data, (res) => {
      setMembers(res.members || []);
    });
  };

  // 🔹 일정
  const loadSchedules = async () => {
    const res = await fetch(
      `${API_URL}?action=schedules&date=${date}`
    );
    const data = await res.json();

    handleResponse(data, (res) => {
      setSchedules(res.schedules || []);
    });
  };

  // 🔥 블록
  const loadBlocks = async () => {
    const res = await fetch(
      `${API_URL}?action=blocks&date=${date}`
    );
    const data = await res.json();

    handleResponse(data, (res) => {
      setBlocks(res.blocks || []);
    });
  };

  // 🔄 초기 로딩 + 날짜 변경
  useEffect(() => {
    loadMembers();
    loadSchedules();
    loadBlocks();
  }, [date]);

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold", marginBottom: 10 }}>
        익쏘 마작 시간 조율 시스템
      </h1>

      {/* ✅ 메시지 */}
      {message && (
        <div
          style={{
            background: "#e8f5e9",
            color: "#2e7d32",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
          }}
        >
          {message}
        </div>
      )}

      {/* 날짜 선택 */}
      <div style={{ marginBottom: 20 }}>
        <label>날짜 선택: </label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <hr />

      {/* 회원 */}
      <h2>👥 회원 ({members.length})</h2>
      <ul>
        {members.map((m, i) => (
          <li key={i}>{m.nickname}</li>
        ))}
      </ul>

      <hr />

      {/* 일정 */}
      <h2>📅 일정 ({schedules.length})</h2>
      <ul>
        {schedules.map((s) => (
          <li key={s.id}>
            {s.nickname} / {s.start} ~ {s.end} / {s.table}
          </li>
        ))}
      </ul>

      <hr />

      {/* 블록 */}
      <h2>🚧 운영 블록 ({blocks.length})</h2>
      <ul>
        {blocks.map((b) => (
          <li key={b.id}>
            {b.title} / {b.start} ~ {b.end} / {b.scope}
          </li>
        ))}
      </ul>
    </div>
  );
}
