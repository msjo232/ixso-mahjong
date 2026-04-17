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

type MemoItem = {
  id: string;
  date: string;
  nickname: string;
  content: string;
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

type MemosResponse = {
  success: boolean;
  memos: MemoItem[];
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

function isSameOrAfterToday(dateString: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return false;

  return target >= today;
}

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
  const m = String(time || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  let slot = hour * 2 + (minute === 30 ? 1 : 0);
  if (slot < 12) slot += 48;
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

function formatDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function normalizeDate(value: unknown) {
  const str = String(value || "").trim();
  if (!str) return "";
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const mo = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  return str;
}

function normalizeTime(value: unknown) {
  const str = String(value || "").trim();
  if (!str) return "";
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;

  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const hh = String(parsed.getHours()).padStart(2, "0");
    const mm = String(parsed.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return str;
}

function normalizeTable(value: unknown): TableType {
  const str = String(value || "").trim();
  return str === "2탁" ? "2탁" : "1탁";
}

function normalizeEntry(raw: any): Entry {
  return {
    id: String(raw?.id || ""),
    nickname: String(raw?.nickname || ""),
    date: normalizeDate(raw?.date),
    start: normalizeTime(raw?.start),
    end: normalizeTime(raw?.end),
    table: normalizeTable(raw?.table),
    memo: String(raw?.memo || ""),
    createdAt: String(raw?.createdAt || ""),
  };
}

function normalizeMemo(raw: any): MemoItem {
  return {
    id: String(raw?.id || ""),
    date: normalizeDate(raw?.date),
    nickname: String(raw?.nickname || ""),
    content: String(raw?.content || ""),
    createdAt: String(raw?.createdAt || ""),
  };
}

function getKoreanWeekday(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  return weekdays[date.getDay()] || "";
}

function formatKoreanDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekday = getKoreanWeekday(dateString);
  return `${y}. ${m}. ${d} (${weekday})`;
}

export default function Page() {
  const [tab, setTab] = useState<TabType>("timeline");
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [currentUser, setCurrentUser] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [memos, setMemos] = useState<MemoItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [messageText, setMessageText] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("success");

  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingMemos, setLoadingMemos] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savingMemo, setSavingMemo] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingMemoId, setDeletingMemoId] = useState<string | null>(null);

  const [nicknameQuery, setNicknameQuery] = useState("");
  const [showNicknameSuggestions, setShowNicknameSuggestions] = useState(false);

  const [currentUserQuery, setCurrentUserQuery] = useState("");
  const [showCurrentUserSuggestions, setShowCurrentUserSuggestions] =
    useState(false);
  const [hasSelectedCurrentUser, setHasSelectedCurrentUser] = useState(false);

  const [selectedTimelineEntries, setSelectedTimelineEntries] = useState<Entry[]>(
    []
  );
  const [memoInput, setMemoInput] = useState("");

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
    const timer = window.setTimeout(() => setMessageText(""), 2000);
    return () => window.clearTimeout(timer);
  }, [messageText]);

  async function loadMembers() {
    setLoadingMembers(true);
    try {
      const res = await fetch("/api/mahjong?action=members", {
        cache: "no-store",
      });
      const data: MembersResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "회원 목록을 불러오지 못했습니다.");
      }

      setMembers(data.members || []);
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
    try {
      const res = await fetch(
        `/api/mahjong?action=schedules&date=${encodeURIComponent(date)}`,
        { cache: "no-store" }
      );
      const data: SchedulesResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "일정 데이터를 불러오지 못했습니다.");
      }

      setEntries((data.schedules || []).map(normalizeEntry));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "일정 데이터를 불러오는 중 오류가 발생했습니다.",
        "error"
      );
      setEntries([]);
    } finally {
      setLoadingSchedules(false);
    }
  }

  async function loadAllSchedules() {
    try {
      const res = await fetch("/api/mahjong?action=schedules", {
        cache: "no-store",
      });
      const data: SchedulesResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "전체 일정 데이터를 불러오지 못했습니다.");
      }

      setAllEntries((data.schedules || []).map(normalizeEntry));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "전체 일정 데이터를 불러오는 중 오류가 발생했습니다.",
        "error"
      );
      setAllEntries([]);
    }
  }

  async function loadMemos(date: string) {
    setLoadingMemos(true);
    try {
      const res = await fetch(
        `/api/mahjong?action=memos&date=${encodeURIComponent(date)}`,
        { cache: "no-store" }
      );
      const data: MemosResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "메모 데이터를 불러오지 못했습니다.");
      }

      setMemos((data.memos || []).map(normalizeMemo));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "메모 데이터를 불러오는 중 오류가 발생했습니다.",
        "error"
      );
      setMemos([]);
    } finally {
      setLoadingMemos(false);
    }
  }

  useEffect(() => {
    loadMembers();
    loadAllSchedules();
  }, []);

  useEffect(() => {
    loadSchedules(selectedDate);
    loadMemos(selectedDate);
    setForm((prev) => ({ ...prev, date: selectedDate }));
    setSelectedTimelineEntries([]);
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

      if (
        currentUserBoxRef.current &&
        !currentUserBoxRef.current.contains(target)
      ) {
        setShowCurrentUserSuggestions(false);
        if (hasSelectedCurrentUser && currentUser) {
          setCurrentUserQuery(currentUser);
        } else {
          setCurrentUserQuery("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [currentUser, hasSelectedCurrentUser]);

  const dayEntries = useMemo(
    () => entries.filter((item) => item.date === selectedDate),
    [entries, selectedDate]
  );

  const filteredMembers = useMemo(() => {
    if (!nicknameQuery.trim()) return members.slice(0, 8);
    return members
      .filter((member) => matchesNickname(nicknameQuery, member.nickname))
      .slice(0, 8);
  }, [members, nicknameQuery]);

  const filteredCurrentUsers = useMemo(() => {
    if (!currentUserQuery.trim()) return members.slice(0, 8);
    return members
      .filter((member) => matchesNickname(currentUserQuery, member.nickname))
      .slice(0, 8);
  }, [members, currentUserQuery]);

  const timelineByTable = useMemo(
    () => ({
      "1탁": assignLanes(dayEntries.filter((entry) => entry.table === "1탁")),
      "2탁": assignLanes(dayEntries.filter((entry) => entry.table === "2탁")),
    }),
    [dayEntries]
  );

  const myEntries = useMemo(() => {
    return currentUser
      ? [...allEntries]
          .filter(
            (item) =>
              item.nickname === currentUser && isSameOrAfterToday(item.date)
          )
          .sort((a, b) => {
            if (a.date !== b.date) return a.date.localeCompare(b.date);
            return timeToSlot(a.start) - timeToSlot(b.start);
          })
      : [];
  }, [allEntries, currentUser]);

  const mergedMemos = useMemo(() => {
    return [...memos].sort((a, b) => {
      const aTime = new Date((a.createdAt || "").replace(" ", "T")).getTime();
      const bTime = new Date((b.createdAt || "").replace(" ", "T")).getTime();

      if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
      if (Number.isNaN(aTime)) return 1;
      if (Number.isNaN(bTime)) return -1;
      return aTime - bTime;
    });
  }, [memos]);

  const selectedCommonInfo = useMemo(() => {
    if (selectedTimelineEntries.length < 2) return null;

    const first = selectedTimelineEntries[0];
    const sameTable = selectedTimelineEntries.every(
      (entry) => entry.table === first.table
    );

    if (!sameTable) {
      return {
        hasCommonTime: false,
        table: first.table,
        start: "",
        end: "",
        names: selectedTimelineEntries.map((entry) => entry.nickname),
      };
    }

    const startSlot = Math.max(
      ...selectedTimelineEntries.map((entry) => timeToSlot(entry.start))
    );
    const endSlot = Math.min(
      ...selectedTimelineEntries.map((entry) => timeToSlot(entry.end))
    );

    if (startSlot >= endSlot) {
      return {
        hasCommonTime: false,
        table: first.table,
        start: "",
        end: "",
        names: selectedTimelineEntries.map((entry) => entry.nickname),
      };
    }

    return {
      hasCommonTime: true,
      table: first.table,
      start: slotToTime(startSlot),
      end: slotToTime(endSlot),
      names: selectedTimelineEntries.map((entry) => entry.nickname),
    };
  }, [selectedTimelineEntries]);

  const leftAxisHighlight = useMemo(() => {
    if (!selectedCommonInfo?.hasCommonTime) return null;
    if (selectedCommonInfo.table !== "1탁") return null;
    return {
      startSlot: timeToSlot(selectedCommonInfo.start),
      endSlot: timeToSlot(selectedCommonInfo.end),
    };
  }, [selectedCommonInfo]);

  const centerAxisHighlight = useMemo(() => {
    if (!selectedCommonInfo?.hasCommonTime) return null;
    if (selectedCommonInfo.table !== "2탁") return null;
    return {
      startSlot: timeToSlot(selectedCommonInfo.start),
      endSlot: timeToSlot(selectedCommonInfo.end),
    };
  }, [selectedCommonInfo]);

  function buildSinglePromoMessage() {
    if (selectedTimelineEntries.length !== 1) return "";

    const entry = selectedTimelineEntries[0];
    const weekday = getKoreanWeekday(entry.date);

    return `🀄 익쏘 마작 모집

📅 ${entry.date} (${weekday})
🕒 ${entry.start} ~ ${entry.end}
🪑 ${entry.table}

현재 가능 인원 1명
${entry.nickname}

3인 모집중입니다.

참여 가능하신 분은 일정등록해주세요.`;
  }

  function buildCommonPromoMessage() {
    if (!selectedCommonInfo || !selectedCommonInfo.hasCommonTime) return "";

    const count = selectedTimelineEntries.length;
    const names = selectedCommonInfo.names.join(", ");
    const weekday = getKoreanWeekday(selectedDate);

    if (count >= 4) {
      return `🀄 익쏘 마작 확정

📅 ${selectedDate} (${weekday})
🕒 ${selectedCommonInfo.start} ~ ${selectedCommonInfo.end}
🪑 ${selectedCommonInfo.table}

참가 인원 4명
${names}

모집이 완료되었습니다 👍`;
    }

    const needed = Math.max(0, 4 - count);

    return `🀄 익쏘 마작 모집

📅 ${selectedDate} (${weekday})
🕒 ${selectedCommonInfo.start} ~ ${selectedCommonInfo.end}
🪑 ${selectedCommonInfo.table}

현재 가능 인원 ${count}명
${names}

${needed}인 모집중입니다.

참여 가능하신 분은 일정등록해주세요.`;
  }

  async function copyText(text: string, successText = "복사되었습니다.") {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successText, "success");
    } catch {
      showToast("복사에 실패했습니다. 브라우저 권한을 확인해주세요.", "error");
    }
  }

  async function copySinglePromoMessage() {
    const text = buildSinglePromoMessage();
    if (!text) {
      showToast("1명 선택 시에만 사용할 수 있습니다.", "warning");
      return;
    }
    await copyText(text, "홍보 문구가 복사되었습니다.");
  }

  async function copyCommonPromoMessage() {
    const text = buildCommonPromoMessage();
    if (!text) {
      showToast("선택한 일정들의 공통시간이 없습니다.", "warning");
      return;
    }
    await copyText(text, "홍보 문구가 복사되었습니다.");
  }

  async function saveMemo() {
    if (!currentUser) {
      showToast("우측 상단에서 닉네임을 먼저 선택해주세요.", "warning");
      return;
    }

    if (!memoInput.trim()) {
      showToast("메모 내용을 입력해주세요.", "warning");
      return;
    }

    setSavingMemo(true);

    try {
      const res = await fetch("/api/mahjong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "saveMemo",
          date: selectedDate,
          nickname: currentUser,
          content: memoInput.trim(),
        }),
      });

      const data: SaveResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "메모 저장에 실패했습니다.");
      }

      setMemoInput("");
      showToast("메모가 저장되었습니다.", "success");
      await loadMemos(selectedDate);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "메모 저장 중 오류가 발생했습니다.",
        "error"
      );
    } finally {
      setSavingMemo(false);
    }
  }

  async function deleteMemo(id: string, nickname: string) {
    if (nickname !== currentUser) {
      showToast("선택한 닉네임의 메모만 삭제할 수 있습니다.", "warning");
      return;
    }

    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;

    setDeletingMemoId(id);

    try {
      const res = await fetch("/api/mahjong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deleteMemo",
          id,
        }),
      });

      const data: SaveResponse = await res.json();

      if (!data.success) {
        throw new Error(data.message || "메모 삭제에 실패했습니다.");
      }

      showToast("메모가 삭제되었습니다.", "success");
      await loadMemos(selectedDate);
      await loadSchedules(selectedDate);
      await loadAllSchedules();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "메모 삭제 중 오류가 발생했습니다.",
        "error"
      );
    } finally {
      setDeletingMemoId(null);
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

      if (prev.length === 0) return [entry];

      const selectedTable = prev[0].table;
      if (selectedTable !== entry.table) {
        showToast("다른 탁은 같이 선택할 수 없습니다.", "warning");
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
      showToast(
        `${form.table}은 해당 시간대에 이미 최대 5명입니다. 탁이 다 찼습니다.`,
        "warning"
      );
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/mahjong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      showToast(
        editingId ? "일정을 수정했어요." : "일정을 저장했어요.",
        "success"
      );
      setSelectedDate(form.date);
      setCurrentUser(form.nickname);
      setCurrentUserQuery(form.nickname);
      setHasSelectedCurrentUser(true);
      setTab("my");
      setEditingId(null);

      await Promise.all([loadSchedules(form.date), loadMemos(form.date), loadAllSchedules()]);

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
    setSelectedTimelineEntries([item]);
    setTab("input");
    setMessageText("");
  }

  async function deleteEntry(id: string) {
    const ok = window.confirm("정말 삭제하시겠습니까?");
    if (!ok) return;

    setDeletingId(id);

    try {
      const res = await fetch("/api/mahjong", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setSelectedTimelineEntries((prev) => prev.filter((item) => item.id !== id));
      await loadSchedules(selectedDate);
      await loadMemos(selectedDate);
      await loadAllSchedules();

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
          <h1 className="text-xl font-bold">익쏘 마작 시간 조율 시스템</h1>
          <p className="mt-1 text-sm text-blue-100">
            모바일 전용 · 1탁 / 2탁 · 06:00 기준
          </p>
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

              {showCurrentUserSuggestions &&
                filteredCurrentUsers.length > 0 &&
                !loadingMembers && (
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
                          <div className="mt-0.5 text-xs text-slate-400">
                            {user.name}
                          </div>
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
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800">메모</h2>
                  <span />
                </div>

                <div className="space-y-2">
                  {loadingMemos ? (
                    <div className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-500">
                      메모를 불러오는 중입니다.
                    </div>
                  ) : mergedMemos.length === 0 ? (
                    <div className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-500">
                      아직 등록된 메모가 없습니다.
                    </div>
                  ) : (
                    mergedMemos.map((item) => {
                      const canDelete = item.nickname === currentUser;

                      return (
                        <div key={item.id} className="rounded-2xl bg-white px-3 py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-semibold text-slate-800">
                                {item.nickname}
                              </div>

                              <button
                                type="button"
                                onClick={() => deleteMemo(item.id, item.nickname)}
                                disabled={deletingMemoId !== null || !canDelete}
                                className={
                                  canDelete
                                    ? "rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 disabled:opacity-50"
                                    : "cursor-not-allowed rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-bold text-gray-300"
                                }
                                title={
                                  canDelete
                                    ? "메모 삭제"
                                    : "선택한 닉네임의 메모만 삭제할 수 있습니다."
                                }
                              >
                                {deletingMemoId === item.id ? "..." : "×"}
                              </button>
                            </div>

                            <div className="shrink-0 text-[11px] text-slate-400">
                              {formatDateTime(item.createdAt)}
                            </div>
                          </div>

                          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                            {item.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-3 rounded-2xl bg-white p-3">
                  <div className="mb-2 text-sm font-medium text-slate-700">
                    메모 작성
                  </div>
                  <textarea
                    value={memoInput}
                    onChange={(e) => setMemoInput(e.target.value)}
                    rows={3}
                    placeholder={
                      currentUser
                        ? `${currentUser} 이름으로 메모가 저장됩니다.`
                        : "우측 상단 회원검색에서 닉네임을 먼저 선택해주세요."
                    }
                    className="w-full rounded-2xl border px-4 py-3 text-sm"
                  />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="text-xs text-slate-500">
                      저장 닉네임: {currentUser || "선택 안 됨"}
                    </div>
                    <button
                      type="button"
                      onClick={saveMemo}
                      disabled={savingMemo}
                      className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {savingMemo ? "메모 저장 중..." : "메모 저장"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border bg-white p-3">
                <div className="mb-3">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-semibold text-slate-800">타임라인</h2>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-500">
                        {formatKoreanDate(selectedDate)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-400">
                        막대를 눌러 선택
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-[50px_minmax(0,1fr)_50px_minmax(0,1fr)] gap-2">
                  <div />
                  <div className="text-center text-xs font-semibold text-emerald-700">
                    1탁
                  </div>
                  <div />
                  <div className="text-center text-xs font-semibold text-indigo-700">
                    2탁
                  </div>

                  <div className="relative h-[960px]">
                    {timeOptions.map((time, i) => {
                      const active = leftAxisHighlight
                        ? isSlotInRange(
                            i,
                            leftAxisHighlight.startSlot,
                            leftAxisHighlight.endSlot
                          )
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
                      const isSelected = selectedTimelineEntries.some(
                        (item) => item.id === entry.id
                      );

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
                            zIndex: 2,
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
                        ? isSlotInRange(
                            i,
                            centerAxisHighlight.startSlot,
                            centerAxisHighlight.endSlot
                          )
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
                      const isSelected = selectedTimelineEntries.some(
                        (item) => item.id === entry.id
                      );

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
                            zIndex: 2,
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
                  원하는 날짜와 시간을 입력하세요.
                  <br />
                  하루 기준은 06:00 ~ 익일 05:30입니다.
                </p>

                <form onSubmit={saveEntry} className="mt-4 space-y-4">
                  <div className="relative" ref={nicknameBoxRef}>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      닉네임
                    </label>
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
                              setForm((prev) => ({
                                ...prev,
                                nickname: user.nickname,
                              }));
                              setNicknameQuery(user.nickname);
                              setShowNicknameSuggestions(false);
                            }}
                            className="block w-full border-b px-4 py-3 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50"
                          >
                            <div className="font-medium">{user.nickname}</div>
                            {user.name && (
                              <div className="mt-0.5 text-xs text-slate-400">
                                {user.name}
                              </div>
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
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      날짜
                    </label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, date: e.target.value }))
                      }
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        시작시간
                      </label>
                      <select
                        value={form.start}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, start: e.target.value }))
                        }
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
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        종료시간
                      </label>
                      <select
                        value={form.end}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, end: e.target.value }))
                        }
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
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      희망탁
                    </label>
                    <select
                      value={form.table}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          table: e.target.value as TableType,
                        }))
                      }
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                    >
                      <option value="1탁">1탁</option>
                      <option value="2탁">2탁</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      메모
                    </label>
                    <textarea
                      value={form.memo}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, memo: e.target.value }))
                      }
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
                    오늘 포함 미래 일정이 없습니다.
                  </div>
                ) : (
                  myEntries.map((item) => (
                    <div key={item.id} className="rounded-3xl border bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3">
                        <div>
                          <div className="text-base font-semibold text-slate-800">
                            {item.date} ({getKoreanWeekday(item.date)})
                          </div>
                          <div className="mt-1 text-sm text-slate-600">
                            {item.start} ~ {item.end} · {item.table}
                          </div>
                          {item.memo && (
                            <div className="mt-2 text-sm text-slate-500">
                              메모: {item.memo}
                            </div>
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

        {selectedTimelineEntries.length > 0 && (
          <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center px-3 pt-4">
            <div className="pointer-events-auto w-full max-w-md rounded-3xl border bg-white p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-slate-800">
                    선택 인원 {selectedTimelineEntries.length}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {selectedTimelineEntries.map((entry) => entry.nickname).join(", ")}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={clearSelectedTimelineEntries}
                  className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600"
                >
                  닫기
                </button>
              </div>

              {selectedTimelineEntries.length === 1 ? (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={copySinglePromoMessage}
                    className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                  >
                    카톡 복사
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => editEntry(selectedTimelineEntries[0])}
                      className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
                    >
                      수정
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteEntry(selectedTimelineEntries[0].id)}
                      disabled={deletingId !== null}
                      className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {deletingId === selectedTimelineEntries[0].id ? "삭제중..." : "삭제"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4">
                  {selectedCommonInfo?.hasCommonTime ? (
                    <>
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        공통 가능 시간: {selectedCommonInfo.start} ~ {selectedCommonInfo.end}
                      </div>

                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={copyCommonPromoMessage}
                          className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white"
                        >
                          카톡 복사
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                      선택한 일정들의 공통시간이 없습니다.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
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
