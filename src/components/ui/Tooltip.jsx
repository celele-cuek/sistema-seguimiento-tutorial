import { useState, useRef, useEffect } from 'react';

export default function Tooltip({ children, content, className = '' }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: true, left: false });
  const wrapRef = useRef(null);
  const tipRef = useRef(null);

  function handleMouseEnter() {
    setVisible(true);
    setTimeout(() => {
      if (!wrapRef.current || !tipRef.current) return;
      const wr = wrapRef.current.getBoundingClientRect();
      const tr = tipRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - wr.bottom;
      const spaceRight = window.innerWidth - wr.left;
      setPos({
        top: spaceBelow > tr.height + 8,
        left: spaceRight < tr.width + 8,
      });
    }, 0);
  }

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && content && (
        <span
          ref={tipRef}
          className={`absolute z-50 w-64 text-xs rounded-lg px-3 py-2 pointer-events-none shadow-lg
            ${pos.top ? 'top-full mt-1' : 'bottom-full mb-1'}
            ${pos.left ? 'right-0' : 'left-0'}
          `}
          style={{ background: 'var(--color-tooltip-bg)', color: 'var(--color-tooltip-text)' }}
        >
          {content}
        </span>
      )}
    </span>
  );
}
