"use client";
import { useEffect, useState } from 'react';

export default function HydrationWrapper({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div suppressHydrationWarning style={{ display: 'contents' }}>
      {mounted ? children : null}
    </div>
  );
}