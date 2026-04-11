'use client';

import { useState } from 'react';

export default function Page() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: 24, fontSize: 24 }}>
      <h1>터치 테스트</h1>
      <p>현재 숫자: {count}</p>
      <button
        onClick={() => setCount(count + 1)}
        style={{
          padding: '16px 24px',
          fontSize: '20px',
          borderRadius: '12px',
          background: '#2563eb',
          color: 'white',
          border: 'none',
        }}
      >
        눌러보기
      </button>
    </div>
  );
}
