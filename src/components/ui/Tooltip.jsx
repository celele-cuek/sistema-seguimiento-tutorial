import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

const MARGIN = 10;   // min gap from viewport edge
const GAP    = 6;    // gap between trigger and tooltip

export default function Tooltip({ children, content, className = '' }) {
  const [coords, setCoords] = useState(null);
  const triggerRef = useRef(null);
  const tipRef     = useRef(null);

  const hide = useCallback(() => setCoords(null), []);

  function place() {
    const tr = triggerRef.current?.getBoundingClientRect();
    if (!tr) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Max width: 256px or viewport minus margins
    const maxW = Math.min(256, vw - 2 * MARGIN);

    // Horizontal: align left edge of tooltip with left edge of trigger,
    // then clamp so right edge doesn't overflow, and left edge not < MARGIN.
    let left = tr.left;
    left = Math.min(left, vw - maxW - MARGIN);
    left = Math.max(left, MARGIN);

    // Vertical: prefer below, fall back to above.
    const spaceBelow = vh - tr.bottom - GAP;
    const spaceAbove = tr.top - GAP;
    const below = spaceBelow >= spaceAbove || spaceAbove < 40;
    const top = below ? tr.bottom + GAP : null;
    // "above" top is calculated after we know the tooltip height (in useEffect)
    const tentativeTop = below ? tr.bottom + GAP : tr.top - GAP;

    setCoords({ left, top: tentativeTop, maxW, below, triggerTop: tr.top });
  }

  // After the tooltip renders, clamp its vertical position if it still overflows.
  useEffect(() => {
    if (!coords || !tipRef.current) return;
    const tr = tipRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    let { top, below, triggerTop } = coords;

    if (below) {
      // clamp bottom edge
      if (tr.bottom > vh - MARGIN) {
        // flip to above
        top = triggerTop - GAP - tr.height;
      }
    } else {
      // above: subtract tooltip height from tentativeTop
      top = triggerTop - GAP - tr.height;
      if (top < MARGIN) {
        // flip to below
        top = triggerTop + (triggerRef.current?.getBoundingClientRect().height ?? 0) + GAP;
      }
    }

    top = Math.max(MARGIN, Math.min(top, vh - tr.height - MARGIN));

    if (top !== coords.top) {
      setCoords(c => c ? { ...c, top } : null);
    }
  }, [coords?.below, coords?.triggerTop, coords?.left]);

  if (!content) {
    return (
      <span className={`inline-flex items-center ${className}`}>{children}</span>
    );
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-flex items-center ${className}`}
        onMouseEnter={place}
        onMouseLeave={hide}
        onFocus={place}
        onBlur={hide}
      >
        {children}
      </span>

      {coords && createPortal(
        <span
          ref={tipRef}
          role="tooltip"
          onMouseLeave={hide}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            maxWidth: coords.maxW,
            zIndex: 9999,
            pointerEvents: 'none',
            background: 'var(--color-tooltip-bg)',
            color: 'var(--color-tooltip-text)',
          }}
          className="text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed"
        >
          {content}
        </span>,
        document.body
      )}
    </>
  );
}
