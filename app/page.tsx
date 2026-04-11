'use client';

import { useMemo, useState } from 'react';

type TabType = 'timeline' | 'input' | 'my';
type TableType = '1탁' | '2탁';

type Entry = {
  id: string;
  nickname: string;
  date: string;
  start: string;
  end: string;
  table: TableType;
  memo: string;
};

const users = ['아카이브', '랑도', '빵빵빵', '침강', '두부'];
const tableOptions: TableType[] = ['1탁', '2탁'];

const timeOptions = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0');
  const m = i % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
});

const initialItems: Entry[] = [
  {
    id: '1',
    nickname: '아카이브',
    date: '2026-04-11',
    start: '19:00',
    end: '23:00',
    table: '1탁',
    memo: '늦을 수도 있음',
  },
  {
    id: '2',
    nickname: '랑도',
    date: '2026-04-11',
    start: '20:00',
    end: '23:00',
    table: '1탁',
    memo: '',
  },
  {
    id: '3',
    nickname: '빵빵빵',
    date: '2026-04-11',
    start: '19:30',
    end: '22:00',
    table: '2탁',
    memo: '',
  },
  {
    id: '4',
    nickname: '침강',
    date: '2026-04-11',
    start: '20:00',
    end: '22:30',
    table: '2탁',
    memo: '',
  },
];

function timeToSlot(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 2 + (minute === 30 ? 1 : 0);
}

function slotToTime(slot: number) {
  const h = String(Math.floor(slot / 2)).padStart(2, '0');
  const m = slot % 2 === 0 ? '00' : '30';
  return `${h}:${m}`;
}

export default function Page() {
  const [tab, setTab] = useState<TabType>('timeline');
  const [selectedDate, setSelectedDate] = useState('2026-04-11');
  const [currentUser, setCurrentUser] = useState('아카이브');
  const [entries, setEntries] = useState<Entry[]>(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const [form, setForm] = useState({
    nickname: '아카이브',
    date: '2026-04-11',
    start: '19:00',
    end: '23:00',
    table: '1탁' as TableType,
    memo: '',
  });

  const dayEntries = useMemo(() => {
    return entries.filter((item) => item.date === selectedDate);
  }, [entries, selectedDate]);

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

  const myEntries = useMemo(() => {
    return entries
      .filter((item) => item.nickname === currentUser)
      .sort((a, b) => `${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`));
  }, [entries, currentUser]);

  function resetForm() {
    setForm({
      nickname: currentUser,
      date: selectedDate,
      start: '19:00',
      end: '23:00',
      table: '1탁',
      memo: '',
    });
    setEditingId(null);
  }

  function saveEntry(e: React.FormEvent) {
    e.preventDefault();

    if (timeToSlot(form.start) >= timeToSlot(form.end)) {
      setMessage('종료시간은 시작시간보다 뒤여야 합니다.');
      return;
    }

    if (editingId) {
      setEntries((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                nickname: form.nickname,
                date: form.date,
                start: form.start,
                end: form.end,
                table: form.table,
                memo: form.memo,
              }
            : item
        )
      );
      setMessage('일정을 수정했어요.');
    } else {
      setEntries((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          nickname: form.nickname,
          date: form.date,
          start: form.start,
          end: form.end,
          table: form.table,
          memo: form.memo,
        },
      ]);
      setMessage('일정을 저장했어요.');
    }

    setSelectedDate(form.date);
    setCurrentUser(form.nickname);
    setTab('my');
    setEditingId(null);
    setForm({
      nickname: form.nickname,
      date: form.date,
      start: '19:00',
      end: '23:00',
      table: '1탁',
      memo: '',
    });
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
    setTab('input');
    setMessage('');
  }

  function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((item) => item.id !== id));
    setMessage('일정을 삭제했어요.');
    if (editingId === id) {
      resetForm();
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-24">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white shadow-xl">
        <header className="bg-blue-600 px-4 pb-5 pt-6 text-white">
          <h1 className="text-xl font-bold">익쏘 마작 시간 조율 시스템</h1>
          <p className="mt-1 text-sm text-blue-100">모바일 전용 · 1탁 / 2탁</p>
        </header>

        <div className="border-b bg-white px-3 py-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setForm((prev) => ({ ...prev, date: e.target.value }));
              }}
              className="rounded-xl border px-3 py-2 text-sm"
            />
            <select
              value={currentUser}
              onChange={(e) => {
                setCurrentUser(e.target.value);
                setForm((prev) => ({ ...prev, nickname: e.target.value }));
              }}
              className="rounded-xl border px-3 py-2 text-sm"
            >
              {users.map((user) => (
                <option key={user} value={user}>
                  {user}
                </option>
              ))}
            </select>
          </div>
        </div>

        {message && (
          <div className="mx-3 mt-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <main className="flex-1">
          {tab === 'timeline' && (
            <div className="space-y-3 p-3">
              <div className="rounded-3xl border bg-slate-50 p-4">
                <h2 className="text-base font-semibold text-slate-800">날짜 요약</h2>
                <p className="mt-1 text-sm text-slate-500">{selectedDate}</p>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-2xl bg-white px-3 py-3 text-slate-700">
                    입력 인원
                    <div className="mt-1 text-lg font-bold text-slate-900">{dayEntries.length}명</div>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-3 text-slate-700">
                    겹침 구간
                    <div className="mt-1 text-lg font-bold text-slate-900">{overlapSummary.length}개</div>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {overlapSummary.length === 0 ? (
                    <div className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-500">
                      아직 4명 이상 겹치는 구간이 없어요.
                    </div>
                  ) : (
                    overlapSummary.map((item, idx) => (
                      <div key={idx} className="rounded-2xl bg-amber-50 px-3 py-3 text-sm text-amber-800">
                        {item.start} ~ {item.end} · 최대 {item.count}명 가능
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border bg-white p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-slate-800">타임라인</h2>
                  <span className="text-xs text-slate-400">모바일 세로형</span>
                </div>

                <div className="grid grid-cols-[50px_repeat(2,minmax(0,1fr))] gap-2">
                  <div />
                  <div className="text-center text-xs font-semibold text-slate-600">1탁</div>
                  <div className="text-center text-xs font-semibold text-slate-600">2탁</div>

                  <div className="relative h-[960px]">
                    {timeOptions.map((time, i) => (
                      <div
                        key={time}
                        className="absolute left-0 right-0 flex h-5 -translate-y-1/2 items-start text-[10px] text-slate-400"
                        style={{ top: `${i * 20}px` }}
                      >
                        {time}
                      </div>
                    ))}
                  </div>

                  {(['1탁', '2탁'] as const).map((column) => {
                    const columnEntries = dayEntries.filter((entry) => entry.table === column);

                    return (
                      <div key={column} className="relative h-[960px] overflow-hidden rounded-2xl bg-slate-50">
                        {timeOptions.map((_, i) => (
                          <div
                            key={i}
                            className="absolute left-0 right-0 border-t border-slate-200"
                            style={{ top: `${i * 20}px` }}
                          />
                        ))}

                        {columnEntries.map((entry, idx) => {
                          const start = timeToSlot(entry.start);
                          const end = timeToSlot(entry.end);

                          return (
                            <div
                              key={entry.id}
                              className="absolute rounded-2xl bg-green-500 px-1 py-2 text-center text-[10px] font-semibold text-white shadow"
                              style={{
                                left: `${6 + (idx % 2) * 28}px`,
                                width: '24px',
                                top: `${start * 20}px`,
                                height: `${(end - start) * 20}px`,
                              }}
                            >
                              <div className="flex h-full items-center justify-center [writing-mode:vertical-rl] [text-orientation:mixed]">
                                {entry.nickname}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === 'input' && (
            <div className="p-3">
              <div className="rounded-3xl border bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-800">가능 시간 입력</h2>
                <p className="mt-1 text-sm text-slate-500">원하는 날짜와 시간을 입력하세요.</p>

                <form onSubmit={saveEntry} className="mt-4 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">닉네임</label>
                    <select
                      value={form.nickname}
                      onChange={(e) => setForm((prev) => ({ ...prev, nickname: e.target.value }))}
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                    >
                      {users.map((user) => (
                        <option key={user} value={user}>
                          {user}
                        </option>
                      ))}
                    </select>
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
                      onChange={(e) => setForm((prev) => ({ ...prev, table: e.target.value as TableType }))}
                      className="w-full rounded-2xl border px-4 py-3 text-sm"
                    >
                      {tableOptions.map((table) => (
                        <option key={table} value={table}>
                          {table}
                        </option>
                      ))}
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

                  <div className="grid grid-cols-2 gap-3">
                    <button type="submit" className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow">
                      {editingId ? '수정 저장' : '저장'}
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

          {tab === 'my' && (
            <div className="p-3">
              <div className="mb-3 rounded-3xl border bg-slate-50 p-4">
                <h2 className="text-lg font-semibold text-slate-800">내 일정</h2>
                <p className="mt-1 text-sm text-slate-500">현재 선택된 닉네임: {currentUser}</p>
              </div>

              <div className="space-y-3">
                {myEntries.length === 0 ? (
                  <div className="rounded-3xl border bg-slate-50 p-6 text-sm text-slate-500">
                    아직 입력한 일정이 없습니다.
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
                          {item.memo && <div className="mt-2 text-sm text-slate-500">메모: {item.memo}</div>}
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
                            className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700"
                          >
                            삭제
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

      <div className="fixed bottom-0 left-0 right-0 border-t bg-white z-50">
        <div className="mx-auto grid max-w-md grid-cols-3">
          <button
            type="button"
            onClick={() => setTab('timeline')}
            className={`py-4 text-sm font-medium ${tab === 'timeline' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            타임라인
          </button>
          <button
            type="button"
            onClick={() => setTab('input')}
            className={`py-4 text-sm font-medium ${tab === 'input' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            시간입력
          </button>
          <button
            type="button"
            onClick={() => setTab('my')}
            className={`py-4 text-sm font-medium ${tab === 'my' ? 'text-blue-600' : 'text-slate-400'}`}
          >
            내 일정
          </button>
        </div>
      </div>
    </div>
  );
}
