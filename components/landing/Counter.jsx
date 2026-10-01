'use client';

import { useEffect, useState } from 'react';
import { useInView } from './useInView';

/* ─── animated counter ─── */
export function Counter({ target, suffix = '' }) {
  const [val, setVal] = useState(0);
  const [ref, visible] = useInView();
  useEffect(() => {
    if (!visible) return;
    const num = parseInt(target.replace(/\D/g, ''), 10);
    const step = Math.ceil(num / 60);
    let cur = 0;
    const id = setInterval(() => {
      cur = Math.min(cur + step, num);
      setVal(cur);
      if (cur >= num) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, [visible, target]);
  return <span ref={ref}>{target.startsWith('+') ? '+' : ''}{val.toLocaleString()}{suffix}</span>;
}
