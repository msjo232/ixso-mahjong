"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TabType = "timeline" | "input" | "my";
type TableType = "1탁" | "2탁";
type MessageType = "success" | "warning" | "error";

type Member = {
  nickname: string;
  name?: string;
  status?: string;
  role?: string;
  note?: string;
};

type Entry = {
  id: string;
  nickname: string;
  date: string;
  start: string;
  end: string;
  table: TableType;
  memo: string;
  createdAt?: string;
};

type MembersResponse = {
  success: boolean;
  members: Member[];
  message?: string;
};

type SchedulesResponse = {
  success: boolean;
  schedules: Entry[];
  message?: string;
};

type SaveResponse = {
  success: boolean;
  id?: string;
  message?: string;
};

type TimelineEntry = Entry & {
  lane: number;
};

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 06:00 ~ 익일 05:30
 */
const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const total = i + 12;
  const h = String(Math.floor(total / 2) % 24).padStart(2, "0");
  const m = total % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
});

const CHOSEONG = [
  "ㄱ",
  "ㄲ",
  "ㄴ",
  "ㄷ",
  "ㄸ",
  "ㄹ",
  "ㅁ",
  "ㅂ",
  "ㅃ",
  "ㅅ",
  "ㅆ",
  "ㅇ",
  "ㅈ",
  "ㅉ",
  "ㅊ",
  "ㅋ",
  "ㅌ",
  "ㅍ",
  "ㅎ",
];

function getChoseong(text: string) {
  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0) - 0xac00;
      if (code >= 0 && code <= 11171) {
        return CHOSEONG[Math.floor(code / 588)];
      }
      return char;
    })
    .join("");
}

function matchesNickname(query: string, nickname: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const lowerNickname = nickname.toLowerCase();
  const nicknameChoseong = getChoseong(nickname);

  return (
    lowerNickname.includes(q) ||
    nicknameChoseong.includes(q) ||
    nickname.includes(query.trim())
  );
}

function timeToSlot(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  let slot = hour * 2 + (minute === 30 ? 1 : 0);

  if (slot < 12) {
    slot += 48;
  }

  return slot - 12;
}

function slotToTime(slot: number) {
  const real = (slot + 12) % 48;
  const h = String(Math.floor(real / 2)).padStart(2, "0");
  const m = real % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  const aS = timeToSlot(aStart);
  const aE = timeToSlot(aEnd);
  const bS = timeToSlot(bStart);
  const bE = timeToSlot(bEnd);

  return aS < bE && aE > bS;
}

function assignLanes(entries: Entry[]): TimelineEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const diff = timeToSlot(a.start) - timeToSlot(b.start);
    if (diff !== 0) return diff;
    return timeToSlot(a.end) - timeToSlot(b.end);
  });

  const laneEndSlots = [-1, -1, -1, -1, -1];

  return sorted.map((entry) => {
    const startSlot = timeToSlot(entry.start);
    const endSlot = timeToSlot(entry.end);

    let assignedLane = 0;

    for (let i = 0; i < 5; i += 1) {
      if (startSlot >= laneEndSlots[i]) {
        assignedLane = i;
        laneEndSlots[i] = endSlot;
        break;
      }
    }

    return {
      ...entry,
      lane: assignedLane,
    };
  });
}

function isSlotInRange(slot: number, startSlot: number, endSlot: number) {
  return slot >= startSlot && slot <= endSlot;
}

export default function Page() {
  const [tab, setTab] = useState<TabType>("timeline");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [currentUser, setCurrentUser] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [messageText, setMessageText] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("success");

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [nicknameQuery, setNicknameQuery] = useState("");
  const [showNicknameSuggestions, setShowNicknameSuggestions] = useState(false);

  const [currentUserQuery, setCurrentUserQuery] = useState("");
  const [showCurrentUserSuggestions, setShowCurrentUserSuggestions] = useState(false);
  const [hasSelectedCurrentUser, setHasSelectedCurrentUser] = useState(false);

  const [selectedTimelineEntries, setSelectedTimelineEntries] = useState<Entry[]>([]);

  const nicknameBoxRef = useRef<HTMLDivElement | null>(null);
  const currentUserBoxRef = useRef<HTMLDivElement | null>(null);

  const [form, setForm] = useState({
    nickname: "",
    date: getToday(),
    start: "19:00",
    end: "23:00",
    table: "1탁" as TableType,
    memo: "",
  });

  function showToast(text: string, type: MessageType) {
    setMessageText(text);
    setMessageType(type);
  }

  useEffect(() => {
    if (!messageText) return;

    const timer = window.setTimeout(() => {
      setMessageText("");
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [messageText]);

  async function loadMembers() {
    setLoadingMembers(true);
    setMessageText("");

    try {
      const res = await fetch("/api/mahjong?action=members", {
        cache: "no-store",
      });
      const data: MembersResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "회원 목록을 불러오지 못했습니다.");
      }

      setMembers(data.members);
      setCurrentUser("");
      setCurrentUserQuery("");
      setHasSelectedCurrentUser(false);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "회원 목록을 불러오는 중 오류가 발생했습니다.",
        "error"
      );
    } finally {
      setLoadingMembers(false);
    }
  }

  async function loadSchedules(date: string) {
    setLoadingSchedules(true);
    setMessageText("");

    try {
      const res = await fetch(
        `/api/mahjong?action=schedules&date=${encodeURIComponent(date)}`,
        {
          cache: "no-store",
        }
      );
      const data: SchedulesResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "일정 데이터를 불러오지 못했습니다.");
      }

      const normalized = data.schedules.map((item) => ({
        ...item,
        table: item.table as TableType,
      }));

      setEntries(normalized);
      setSelectedTimelineEntries([]);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "일정 데이터를 불러오는 중 오류가 발생했습니다.",
        "error"
      );
      setEntries([]);
      setSelectedTimelineEntries([]);
    } finally {
      setLoadingSchedules(false);
    }
  }

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    loadSchedules(selectedDate);
    setForm((prev) => ({ ...prev, date: selectedDate }));
  }, [selectedDate]);

  useEffect(() => {
    if (currentUser) {
      setCurrentUserQuery(currentUser);
      setForm((prev) => ({
        ...prev,
        nickname: prev.nickname || currentUser,
      }));
      setNicknameQuery((prev) => prev || currentUser);
    }
  }, [currentUser]);

  useEffect(() => {
    if (form.nickname) {
      setNicknameQuery(form.nickname);
    }
  }, [form.nickname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      if (nicknameBoxRef.current && !nicknameBoxRef.current.contains(target)) {
        setShowNicknameSuggestions(false);
      }

      if (currentUserBoxRef.current && !currentUserBoxRef.current.contains(target)) {
        setShowCurrentUserSuggestions(false);
        if (hasSelectedCurrentUser && currentUser) {
          setCurrentUserQuery(currentUser);
        } else {
          setCurrentUserQuery("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [currentUser, hasSelectedCurrentUser]);

  const dayEntries = useMemo(() => {
    return entries.filter((item) => item.date === selectedDate);
  }, [entries, selectedDate]);

  const filteredMembers = useMemo(() => {
    if (!nicknameQuery.trim()) {
      return members.slice(0, 8);
    }

    return members
      .filter((member) => matchesNickname(nicknameQuery, member.nickname))
      .slice(0, 8);
  }, [members, nicknameQuery]);

  const filteredCurrentUsers = useMemo(() => {
    if (!currentUserQuery.trim()) {
      return members.slice(0, 8);
    }

    return members
      .filter((member) => matchesNickname(currentUserQuery, member.nickname))
      .slice(0, 8);
  }, [members, currentUserQuery]);

  const overlapSummary = useMemo(() => {
    const counts = Array.from({ length: 48 }, (_, slot) => ({ slot, count: 0 }));

    dayEntries.forEach((entry) => {
      const start = timeToSlot(entry.start);
      const end = timeToSlot(entry.end);
      for (let s = start; s < end; s += 1) {
        counts[s].count += 1;
      }
    });

    const result: Array<{ start: string; end: string; count: number }> = [];
    let rangeStart: number | null = null;

    for (let i = 0; i < counts.length; i += 1) {
      const active = counts[i].count >= 4;

      if (active && rangeStart === null) {
        rangeStart = i;
      }

      if ((!active || i === counts.length - 1) && rangeStart !== null) {
        const endSlot = active && i === counts.length - 1 ? i + 1 : i;
        result.push({
          start: slotToTime(rangeStart),
          end: slotToTime(endSlot),
          count: Math.max(...counts.slice(rangeStart, endSlot).map((v) => v.count)),
        });
        rangeStart = null;
      }
    }

    return result;
  }, [dayEntries]);

  const tableWarnings = useMemo(() => {
    return (["1탁", "2탁"] as TableType[]).map((table) => {
      const tableEntries = dayEntries.filter((entry) => entry.table === table);
      let maxOverlap = 0;

      for (let slot = 0; slot < 48; slot += 1) {
        const count = tableEntries.filter((entry) => {
          const start = timeToSlot(entry.start);
          const end = timeToSlot(entry.end);
          return slot >= start && slot < end;
        }).length;

        if (count > maxOverlap) {
          maxOverlap = count;
        }
      }

      return {
        table,
        maxOverlap,
        full: maxOverlap >= 5,
      };
    });
  }, [dayEntries]);

  const timelineByTable = useMemo(() => {
    return {
      "1탁": assignLanes(dayEntries.filter((entry) => entry.table === "1탁")),
      "2탁": assignLanes(dayEntries.filter((entry) => entry.table === "2탁")),
    };
  }, [dayEntries]);

  const myEntries = useMemo(() => {
    return currentUser
      ? entries
          .filter((item) => item.nickname === currentUser)
          .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return timeToSlot(a.start) - timeToSlot(b.start);
          })
      : [];
  }, [entries, currentUser]);

  const selectedTimelineInfo = useMemo(() => {
    if (selectedTimelineEntries.length !== 4) {
      return null;
    }

    const table = selectedTimelineEntries[0].table;
    const allSameTable = selectedTimelineEntries.every((entry) => entry.table === table);

    if (!allSameTable) {
      return {
        table,
        names: selectedTimelineEntries.map((entry) => entry.nickname),
        hasCommonTime: false,
        start: "",
        end: "",
        startSlot: -1,
        endSlot: -1,
      };
    }

    const startSlot = Math.max(...selectedTimelineEntries.map((entry) => timeToSlot(entry.start)));
    const endSlot = Math.min(...selectedTimelineEntries.map((entry) => timeToSlot(entry.end)));

    if (startSlot >= endSlot) {
      return {
        table,
        names: selectedTimelineEntries.map((entry) => entry.nickname),
        hasCommonTime: false,
        start: "",
        end: "",
        startSlot: -1,
        endSlot: -1,
      };
    }

    return {
      table,
      names: selectedTimelineEntries.map((entry) => entry.nickname),
      hasCommonTime: true,
      start: slotToTime(startSlot),
      end: slotToTime(endSlot),
      startSlot,
      endSlot,
    };
  }, [selectedTimelineEntries]);

  const leftAxisHighlight = useMemo(() => {
    if (!selectedTimelineInfo?.hasCommonTime) return null;
    if (selectedTimelineInfo.table !== "1탁") return null;
    return {
      startSlot: selectedTimelineInfo.startSlot,
      endSlot: selectedTimelineInfo.endSlot,
    };
  }, [selectedTimelineInfo]);

  const centerAxisHighlight = useMemo(() => {
    if (!selectedTimelineInfo?.hasCommonTime) return null;
    if (selectedTimelineInfo.table !== "2탁") return null;
    return {
      startSlot: selectedTimelineInfo.startSlot,
      endSlot: selectedTimelineInfo.endSlot,
    };
  }, [selectedTimelineInfo]);

  function buildSelectedGroupMessage() {
    if (!selectedTimelineInfo || !selectedTimelineInfo.hasCommonTime) return "";

    const memberLines = selectedTimelineInfo.names.map((name) => `- ${name}`).join("\n");

    return `🀄 익쏘 마작 모임 확정

📅 ${selectedDate}
🕒 ${selectedTimelineInfo.start} ~ ${selectedTimelineInfo.end}
🪑 ${selectedTimelineInfo.table}

참여 인원
${memberLines}

참여 가능하신 분들은 톡방에 확인 남겨주세요.`;
  }

  async function copySelectedGroupMessage() {
    if (!selectedTimelineInfo || !selectedTimelineInfo.hasCommonTime) {
      showToast("선택한 4명의 공통 가능 시간이 없습니다.", "error");
      return;
    }

    try {
      const text = buildSelectedGroupMessage();
      await navigator.clipboard.writeText(text);
      showToast("복사되었습니다.", "success");
    } catch {
      showToast("복사에 실패했습니다. 브라우저 권한을 확인해주세요.", "error");
    }
  }

  function resetForm() {
    setForm({
      nickname: currentUser,
      date: selectedDate,
      start: "19:00",
      end: "23:00",
      table: "1탁",
      memo: "",
    });
    setNicknameQuery(currentUser);
    setShowNicknameSuggestions(false);
    setEditingId(null);
  }

  function clearSelectedTimelineEntries() {
    setSelectedTimelineEntries([]);
  }

  function toggleTimelineEntry(entry: Entry) {
    setMessageText("");

    setSelectedTimelineEntries((prev) => {
      const exists = prev.some((item) => item.id === entry.id);

      if (exists) {
        return prev.filter((item) => item.id !== entry.id);
      }

      if (prev.length === 0) {
        return [entry];
      }

      const selectedTable = prev[0].table;
      if (selectedTable !== entry.table) {
        showToast("다른 탁은 선택할 수 없습니다.", "warning");
        return prev;
      }

      if (prev.length >= 4) {
        showToast("최대 4명까지만 선택할 수 있어요.", "warning");
        return prev;
      }

      return [...prev, entry];
    });
  }

  async function saveEntry(e: React.FormEvent) {
    e.preventDefault();

    if (!form.nickname.trim()) {
      showToast("닉네임을 입력해주세요.", "error");
      return;
    }

    if (timeToSlot(form.start) >= timeToSlot(form.end)) {
      showToast("종료시간은 시작시간보다 뒤여야 합니다.", "error");
      return;
    }

    const overlappingCount = entries.filter((item) => {
      if (item.table !== form.table) return false;
      if (item.date !== form.date) return false;
      if (editingId && item.id === editingId) return false;

      return overlaps(item.start, item.end, form.start, form.end);
    }).length;

    if (overlappingCount >= 5) {
      showToast(`${form.table}은 해당 시간대에 이미 최대 5명입니다. 탁이 다 찼습니다.`, "warning");
      return;
    }

    setSaving(true);
    setMessageText("");

    try {
      const res = await fetch("/api/mahjong", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "saveSchedule",
          id: editingId || undefined,
          nickname: form.nickname,
          date: form.date,
          start: form.start,
          end: form.end,
          table: form.table,
          memo: form.memo,
        }),
      });

      const data: SaveResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "저장에 실패했습니다.");
      }

      showToast(editingId ? "일정을 수정했어요." : "일정을 저장했어요.", "success");
      setSelectedDate(form.date);
      setCurrentUser(form.nickname);
      setCurrentUserQuery(form.nickname);
      setHasSelectedCurrentUser(true);
      setTab("my");
      setEditingId(null);

      await loadSchedules(form.date);

      setForm({
        nickname: form.nickname,
        date: form.date,
        start: "19:00",
        end: "23:00",
        table: "1탁",
        memo: "",
      });
      setNicknameQuery(form.nickname);
      setShowNicknameSuggestions(false);
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "저장 중 오류가 발생했습니다.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  function editEntry(item: Entry) {
    setEditingId(item.id);
    setForm({
      nickname: item.nickname,
      date: item.date,
      start: item.start,
      end: item.end,
      table: item.table,
      memo: item.memo,
    });
    setNicknameQuery(item.nickname);
    setShowNicknameSuggestions(false);
    setTab("input");
    setMessageText("");
  }

  async function deleteEntry(id: string) {
    setMessageText("");
    setDeletingId(id);

    try {
      const res = await fetch("/api/mahjong", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "deleteSchedule",
          id,
        }),
      });

      const data: SaveResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "삭제에 실패했습니다.");
      }

      showToast("일정을 삭제했어요.", "success");
      await loadSchedules(selectedDate);

      if (editingId === id) {
        resetForm();
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "삭제 중 오류가 발생했습니다.",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  }

  const toastColorClass =
    messageType === "success"
      ? "bg-emerald-500"
      : messageType === "warning"
      ? "bg-amber-500"
      : "bg-rose-500";

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      {messageText && (
        <div className="fixed left-1/2 top-4 z-[100] w-[calc(100%-24px)] max-w-md -translate-x-1/2">
          <div
            className={`rounded-2xl px-4 py-3 text-center text-sm font-semibold text-white shadow-lg ${toastColorClass}`}
          >
            {messageText}
          </div>
        </div>
      )}

      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-xl">
        <header className="bg-blue-600 px-4 pb-5 pt-6 text-white">
          <h1 className="text-xl font-bold">
            익쏘 마작 시간 조율 시스템
          </h1>
          <p className="mt-1 text-sm text-blue-100">모바일 전용 · 1탁 / 2탁 · 06:00 기준</p>
        </header>

        <div className="border-b bg-white px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border px-3 py-2 text-sm"
            />

            <div className="relative" ref={currentUserBoxRef}>
              <input
                type="text"
                value={
                  hasSelectedCurrentUser
                    ? currentUserQuery
                    : showCurrentUserSuggestions
                    ? currentUserQuery
                    : ""
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setCurrentUserQuery(value);
                  setShowCurrentUserSuggestions(true);
                }}
                onFocus={() => {
                  setShowCurrentUserSuggestions(true);
                  if (!hasSelectedCurrentUser) {
                    setCurrentUserQuery("");
                  }
                }}
                placeholder={loadingMembers ? "회원 불러오는 중..." : "회원검색"}
                disabled={loadingMembers || members.length === 0}
                className="w-full rounded-xl border px-3 py-2 text-sm"
              />

              {showCurrentUserSuggestions && filteredCurrentUsers.length > 0 && !loadingMembers && (
                <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-60 overflow-y-auto rounded-2xl border bg-white shadow-lg">
                  {filteredCurrentUsers.map((user) => (
                    <button
                      key={user.nickname}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setCurrentUser(user.nickname);
                        setCurrentUserQuery(user.nickname);
                        setHasSelectedCurrentUser(true);
                        setShowCurrentUserSuggestions(false);
                        setForm((prev) => ({
                          ...prev,
                          nickname: user.nickname,
                        }));
                        setNicknameQuery(user.nickname);
                      }}
                      className="block w-full border-b px-4 py-3 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                    >
                      <div className="font-medium">{user.nickname}</div>
                      {user.name && (
                        <div className="mt-0.5 text-xs text-slate-400">{user.name}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {showCurrentUserSuggestions &&
                currentUserQuery.trim() &&
                filteredCurrentUsers.length === 0 &&
                !loadingMembers && (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
                    검색 결과가 없어요.
                  </div>
                )}
            </div>
          </div>
        </div>

        <main className="flex-1">
          {tab === "timeline" && (
            <div className="space-y-3 p-3">
              <div className="rounded-3xl border bg-slate-50 p-4">
                <h2 className="text-base font-semibold text-slate-800">날짜 요약</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedDate} 06:00 ~ 익일 05:30</p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-white px-3 py-3 text-slate-700">
                    입력 인원
                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {loadingSchedules ? "-" : `${dayEntries.length}명`}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3 text-slate-700">
                    겹침 구간
                    <div className="mt-1 text-lg font-bold text-slate-900">
                      {loadingSchedules ? "-" : `${overlapSummary.length}개`}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {loadingSchedules ? (
                    <div className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-500">
                      일정을 불러오는 중입니다.
                    </div>
                  ) : overlapSummary.length === 0 ? (
                    <div className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-500">
                      아직 4명 이상 겹치는 구간이 없어요.
                    </div>
                  ) : (
                    overlapSummary.map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-800"
                      >
                        {item.start} ~ {item.end} · 최대 {item.count}명 가능
                      </div>
                    ))
                  )}
                </div>

                <div className="mt-3 space-y-2">
                  {tableWarnings.map((item) =>
                    item.full ? (
                      <div
                        key={item.table}
                        className="rounded-2xl bg-rose-50 px-3 py-3 text-sm text-rose-700"
                      >
                        {item.table}은 현재 일부 시간대가 최대 5명으로 가득 찼습니다.
                      </div>
                    ) : (
                      <div
                        key={item.table}
                        className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-500"
                      >
                        {item.table} 최대 겹침 인원: {item.maxOverlap}명
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-3xl border bg-white p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800">타임라인</h2>
                  <span className="text-xs text-slate-400">막대를 눌러 4명 선택</span>
                </div>

                {selectedTimelineEntries.length > 0 && (
                  <div className="mb-3 rounded-2xl border bg-slate-50 px-3 py-3">
                    <div className="text-sm font-semibold text-slate-800">
                      선택 인원 {selectedTimelineEntries.length} / 4
                    </div>
                    <div className="mt-1 text-xs text-slate-600">
                      {selectedTimelineEntries.map((entry) => entry.nickname).join(", ")}
                    </div>

                    {selectedTimelineInfo && selectedTimelineEntries.length === 4 && (
                      <div className="mt-3">
                        {selectedTimelineInfo.hasCommonTime ? (
                          <>
                            <div className="text-sm font-semibold text-slate-800">
                              공통 가능 시간
                            </div>
                            <div className="mt-1 text-sm text-slate-700">
                              {selectedTimelineInfo.table} · {selectedTimelineInfo.start} ~ {selectedTimelineInfo.end}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={copySelectedGroupMessage}
                                className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                              >
                                선택 인원 카톡 복사
                              </button>
                              <button
                                type="button"
                                onClick={clearSelectedTimelineEntries}
                                className="rounded-2xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                              >
                                선택 해제
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-semibold text-rose-700">
                              선택한 4명의 공통 가능 시간이 없습니다.
                            </div>
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={clearSelectedTimelineEntries}
                                className="rounded-2xl bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                              >
                                선택 해제
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-[50px_minmax(0,1fr)_50px_minmax(0,1fr)] gap-2">
                  <div />
                  <div className="text-center text-xs font-semibold text-emerald-700">1탁</div>
                  <div />
                  <div className="text-center text-xs font-semibold text-indigo-700">2탁</div>

                  <div className="relative h-[960px]">
                    {timeOptions.map((time, i) => {
                      const active = leftAxisHighlight
                        ? isSlotInRange(i, leftAxisHighlight.startSlot, leftAxisHighlight.endSlot)
                        : false;

                      return (
                        <div
                          key={`left-${time}`}
                          className="absolute left-0 right-0 flex h-5 -translate-y-1/2 items-start text-[10px]"
                          style={{ top: `${i * 20}px` }}
                        >
                          <span
                            className={`rounded-md px-1.5 py-0.5 ${
                              active
                                ? "bg-amber-200/90 font-semibold text-amber-900"
                                : "text-slate-400"
                            }`}
                          >
                            {time}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="relative h-[960px] overflow-hidden rounded-2xl bg-slate-50">
                    {timeOptions.map((_, i) => (
                      <div
                        key={`line-1-${i}`}
                        className="absolute left-0 right-0 border-t border-slate-200"
                        style={{ top: `${i * 20}px` }}
                      />
                    ))}

                    {timelineByTable["1탁"].map((entry) => {
                      const start = timeToSlot(entry.start);
                      const end = timeToSlot(entry.end);
                      const isSelected = selectedTimelineEntries.some((item) => item.id === entry.id);

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => toggleTimelineEntry(entry)}
                          className={`absolute rounded-xl bg-emerald-500 py-2 text-center text-[11px] font-semibold text-white shadow transition ${
                            isSelected ? "ring-4 ring-yellow-300 scale-[1.02]" : ""
                          }`}
                          style={{
                            left: `calc(${entry.lane} * 20% + 2px)`,
                            width: "calc(20% - 4px)",
                            top: `${start * 20}px`,
                            height: `${(end - start) * 20}px`,
                          }}
                          title={`${entry.nickname} ${entry.start}-${entry.end}`}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="-rotate-90 whitespace-nowrap leading-none text-[10px]">
                              {entry.nickname}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative h-[960px]">
                    {timeOptions.map((time, i) => {
                      const active = centerAxisHighlight
                        ? isSlotInRange(i, centerAxisHighlight.startSlot, centerAxisHighlight.endSlot)
                        : false;

                      return (
                        <div
                          key={`center-${time}`}
                          className="absolute left-0 right-0 flex h-5 -translate-y-1/2 items-start justify-center text-[10px]"
                          style={{ top: `${i * 20}px` }}
                        >
                          <span
                            className={`rounded-md px-1.5 py-0.5 ${
                              active
                                ? "bg-amber-200/90 font-semibold text-amber-900"
                                : "text-slate-400"
                            }`}
                          >
                            {time}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="relative h-[960px] overflow-hidden rounded-2xl bg-slate-50">
                    {timeOptions.map((_, i) => (
                      <div
                        key={`line-2-${i}`}
                        className="absolute left-0 right-0 border-t border-slate-200"
                        style={{ top: `${i * 20}px` }}
                      />
                    ))}

                    {timelineByTable["2탁"].map((entry) => {
                      const start = timeToSlot(entry.start);
                      const end = timeToSlot(entry.end);
                      const isSelected = selectedTimelineEntries.some((item) => item.id === entry.id);

                      return (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => toggleTimelineEntry(entry)}
                          className={`absolute rounded-xl bg-indigo-500 py-2 text-center text-[11px] font-semibold text-white shadow transition ${
                            isSelected ? "ring-4 ring-yellow-300 scale-[1.02]" : ""
                          }`}
                          style={{
                            left: `calc(${entry.lane} * 20% + 2px)`,
                            width: "calc(20% - 4px)",
                            top: `${start * 20}px`,
                            height: `${(end - start) * 20}px`,
                          }}
                          title={`${entry.nickname} ${entry.start}-${entry.end}`}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="-rotate-90 whitespace-nowrap leading-none text-[10px]">
                              {entry.nickname}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "input" && (
            <div className="p-3">
              <div className="rounded-3xl border bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-800">가능 시간 입력</h2>
                <p className="mt-1 text-sm text-slate-500">
                  원하는 날짜와 시간을 입력하세요. 하루 기준은 06:00 ~ 익일 05:30입니다.
                </p>

                <form onSubmit={saveEntry} className="mt-4 space-y-4">
                  <div className="relative" ref={nicknameBoxRef}>
                    <label className="mb-2 block text-sm font-medium text-slate-700">닉네임</label>
                    <input
                      type="text"
                      value={nicknameQuery}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNicknameQuery(value);
                        setShowNicknameSuggestions(true);
                        setForm((prev) => ({ ...prev, nickname: value }));
                      }}
                      onFocus={() => setShowNicknameSuggestions(true)}
                      placeholder="닉네임 검색 (초성 가능)"
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                    />

                    {showNicknameSuggestions && filteredMembers.length > 0 && (
                      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-60 overflow-y-auto rounded-2xl border bg-white shadow-lg">
                        {filteredMembers.map((user) => (
                          <button
                            key={user.nickname}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setForm((prev) => ({ ...prev, nickname: user.nickname }));
                              setNicknameQuery(user.nickname);
                              setShowNicknameSuggestions(false);
                            }}
                            className="block w-full border-b px-4 py-3 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                          >
                            <div className="font-medium">{user.nickname}</div>
                            {user.name && (
                              <div className="mt-0.5 text-xs text-slate-400">{user.name}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {showNicknameSuggestions &&
                      nicknameQuery.trim() &&
                      filteredMembers.length === 0 && (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-500 shadow-lg">
                          검색 결과가 없어요.
                        </div>
                      )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">날짜</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">시작시간</label>
                      <select
                        value={form.start}
                        onChange={(e) => setForm((prev) => ({ ...prev, start: e.target.value }))}
                        className="w-full rounded-2xl border px-3 py-3 text-sm"
                      >
                        {timeOptions.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">종료시간</label>
                      <select
                        value={form.end}
                        onChange={(e) => setForm((prev) => ({ ...prev, end: e.target.value }))}
                        className="w-full rounded-2xl border px-3 py-3 text-sm"
                      >
                        {timeOptions.map((time) => (
                          <option key={time} value={time}>
                            {time}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">희망탁</label>
                    <select
                      value={form.table}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, table: e.target.value as TableType }))
                      }
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                    >
                      <option value="1탁">1탁</option>
                      <option value="2탁">2탁</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">메모</label>
                    <textarea
                      value={form.memo}
                      onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
                      rows={3}
                      placeholder="예: 10분 정도 늦을 수 있음"
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                    />
                  </div>

                  <div className="rounded-2xl bg-slate-100 px-3 py-3 text-xs text-slate-600">
                    같은 시간대에는 한 탁당 최대 5명까지 입력할 수 있습니다.
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow disabled:opacity-50"
                    >
                      {saving ? "저장 중..." : editingId ? "수정 저장" : "저장"}
                    </button>
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-2xl bg-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
                    >
                      초기화
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {tab === "my" && (
            <div className="p-3">
              <div className="mb-3 rounded-3xl border bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-800">내 일정</h2>
                <p className="mt-1 text-sm text-slate-500">
                  현재 선택된 닉네임: {currentUser || "선택 안 됨"}
                </p>
              </div>

              <div className="space-y-3">
                {myEntries.length === 0 ? (
                  <div className="rounded-3xl border bg-slate-50 p-6 text-sm text-slate-500">
                    선택한 회원의 일정이 없습니다.
                  </div>
                ) : (
                  myEntries.map((item) => (
                    <div key={item.id} className="rounded-3xl border bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3">
                        <div>
                          <div className="text-base font-semibold text-slate-800">{item.date}</div>
                          <div className="mt-1 text-sm text-slate-600">
                            {item.start} ~ {item.end} · {item.table}
                          </div>
                          {item.memo && (
                            <div className="mt-2 text-sm text-slate-500">메모: {item.memo}</div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => editEntry(item)}
                            className="rounded-2xl bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteEntry(item.id)}
                            disabled={deletingId !== null}
                            className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700 disabled:opacity-50"
                          >
                            {deletingId === item.id ? "삭제중..." : "삭제"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
        <div className="mx-auto grid max-w-md grid-cols-3">
          <button
            type="button"
            onClick={() => setTab("timeline")}
            className={`py-4 text-sm font-medium ${
              tab === "timeline" ? "text-blue-600" : "text-slate-400"
            }`}
          >
            타임라인
          </button>
          <button
            type="button"
            onClick={() => setTab("input")}
            className={`py-4 text-sm font-medium ${
              tab === "input" ? "text-blue-600" : "text-slate-400"
            }`}
          >
            시간입력
          </button>
          <button
            type="button"
            onClick={() => setTab("my")}
            className={`py-4 text-sm font-medium ${
              tab === "my" ? "text-blue-600" : "text-slate-400"
            }`}
          >
            내 일정
          </button>
        </div>
      </div>
    </div>
  );
}
