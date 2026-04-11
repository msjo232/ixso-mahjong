"use client";

import { useEffect, useMemo, useState } from "react";

/* ===== 타입 ===== */
type TabType = "timeline" | "input" | "my";
type TableType = "1탁" | "2탁";
type InputMode = "schedule" | "block";
type BlockScope = "전체" | "1탁" | "2탁";

/* ===== 유틸 ===== */
function getToday() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function timeToSlot(t: string) {
  const [h, m] = t.split(":").map(Number);
  let slot = h * 2 + (m === 30 ? 1 : 0);
  if (slot < 12) slot += 48;
  return slot - 12;
}

function slotToTime(slot: number) {
  const real = (slot + 12) % 48;
  const h = String(Math.floor(real / 2)).padStart(2, "0");
  const m = real % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
}

function overlaps(aS: string, aE: string, bS: string, bE: string) {
  return timeToSlot(aS) < timeToSlot(bE) && timeToSlot(aE) > timeToSlot(bS);
}

/* ===== 메인 ===== */
export default function Page() {
  const [tab, setTab] = useState<TabType>("timeline");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [entries, setEntries] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function loadData() {
    try {
      const [s, b] = await Promise.all([
        fetch(`/api/mahjong?action=schedules&date=${selectedDate}`),
        fetch(`/api/mahjong?action=blocks&date=${selectedDate}`),
      ]);

      const sd = await s.json();
      const bd = await b.json();

      if (!sd.success || !bd.success) throw new Error("데이터 오류");

      setEntries(sd.schedules || []);
      setBlocks(bd.blocks || []);
      setMessage("");
    } catch (e) {
      setMessage("데이터 불러오기 실패");
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  /* ===== 겹침 계산 ===== */
  const highlight = useMemo(() => {
    const arr = Array(48).fill(0);

    entries.forEach((e) => {
      const s = timeToSlot(e.start);
      const eS = timeToSlot(e.end);
      for (let i = s; i < eS; i++) arr[i]++;
    });

    const res: any[] = [];
    let start: number | null = null;

    for (let i = 0; i < 48; i++) {
      if (arr[i] >= 4 && start === null) start = i;
      if ((arr[i] < 4 || i === 47) && start !== null) {
        res.push({ s: start, e: i });
        start = null;
      }
    }

    return res;
  }, [entries]);

  /* ===== UI ===== */
  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <div className="mx-auto max-w-md bg-white min-h-screen">

        {/* 헤더 */}
        <div className="bg-blue-600 text-white p-4">
          <h1 className="text-lg font-bold">익쏘 마작 시간 조율</h1>
        </div>

        {/* 날짜 */}
        <div className="p-3 border-b">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full border rounded-xl p-2"
          />
        </div>

        {/* 메시지 */}
        {message && (
          <div className="p-3 text-sm text-red-600">{message}</div>
        )}

        {/* 타임라인 */}
        {tab === "timeline" && (
          <div className="p-3">
            <div className="grid grid-cols-[40px_1fr_1fr] gap-2">

              {/* 시간 */}
              <div className="relative h-[960px]">
                {Array.from({ length: 48 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute text-[10px] text-gray-400"
                    style={{ top: i * 20 }}
                  >
                    {slotToTime(i)}
                  </div>
                ))}
              </div>

              {/* 1탁 / 2탁 */}
              {["1탁", "2탁"].map((table) => (
                <div key={table} className="relative h-[960px] bg-gray-50 rounded-xl">

                  {/* 겹침 강조 */}
                  {highlight.map((h, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 bg-yellow-200/60 animate-pulse"
                      style={{
                        top: h.s * 20,
                        height: (h.e - h.s) * 20,
                      }}
                    />
                  ))}

                  {/* 블록 */}
                  {blocks
                    .filter((b) => b.scope === "전체" || b.scope === table)
                    .map((b) => {
                      const s = timeToSlot(b.start);
                      const e = timeToSlot(b.end);
                      return (
                        <div
                          key={b.id}
                          className="absolute left-0 right-0 bg-purple-300/70 border text-xs"
                          style={{
                            top: s * 20,
                            height: (e - s) * 20,
                            zIndex: 10,
                          }}
                        >
                          {b.title}
                        </div>
                      );
                    })}

                  {/* 일정 */}
                  {entries
                    .filter((e) => e.table === table)
                    .map((e) => {
                      const s = timeToSlot(e.start);
                      const en = timeToSlot(e.end);
                      return (
                        <div
                          key={e.id}
                          className={`absolute text-white text-xs flex items-center justify-center ${
                            table === "1탁" ? "bg-green-500" : "bg-blue-500"
                          }`}
                          style={{
                            top: s * 20,
                            height: (en - s) * 20,
                            left: 0,
                            right: 0,
                            zIndex: 20,
                          }}
                        >
                          {e.nickname}
                        </div>
                      );
                    })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 하단 탭 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t grid grid-cols-3">
          <button onClick={() => setTab("timeline")} className="py-3">타임라인</button>
          <button onClick={() => setTab("input")} className="py-3">입력</button>
          <button onClick={() => setTab("my")} className="py-3">내 일정</button>
        </div>

      </div>
    </div>
  );
}
