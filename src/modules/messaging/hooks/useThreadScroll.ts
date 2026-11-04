'use client';

import { useLayoutEffect, useRef, useState, type UIEvent } from 'react';

const NEAR_BOTTOM_PX = 120;
const NEAR_TOP_PX = 200;

/**
 * Scrolling for a flex-col-reverse list, whose scrollTop is 0 at the bottom and negative above it.
 * That layout makes the browser anchor the first paint to the bottom and keep the reader's place
 * when older messages are added on top, so only messages added at the bottom need handling here.
 */
export function useThreadScroll(keys: string[], onNearTop: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const tail = useRef(keys.at(-1));
  const height = useRef(0);
  const away = useRef(0); // px above the bottom, as of the last scroll
  const stick = useRef(false);
  // The last message on screen when the reader scrolled away; null while they're at the bottom.
  const [leftAt, setLeftAt] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const grew = el.scrollHeight - height.current;
    height.current = el.scrollHeight;
    const last = keys.at(-1);
    if (last === tail.current) return; // a tick changed, or older messages arrived on top
    tail.current = last;
    // An absolute value, so it's right whether or not the browser also did its own scroll anchoring.
    el.scrollTop = stick.current || away.current <= NEAR_BOTTOM_PX ? 0 : -(away.current + grew);
    stick.current = false;
  });

  const onScroll = ({ currentTarget: el }: UIEvent<HTMLDivElement>) => {
    away.current = Math.abs(el.scrollTop);
    const far = away.current > NEAR_BOTTOM_PX;
    setLeftAt((cur) => (far ? (cur ?? keys.at(-1) ?? null) : null));
    if (el.scrollHeight - el.clientHeight - away.current < NEAR_TOP_PX) onNearTop();
  };

  const leftIndex = leftAt ? keys.lastIndexOf(leftAt) : -1;
  return {
    ref,
    onScroll,
    /** Messages added below the reader since they scrolled away. */
    newCount: leftIndex < 0 ? 0 : keys.length - 1 - leftIndex,
    jumpToBottom: () => ref.current?.scrollTo({ top: 0, behavior: 'smooth' }),
    /** The next message added goes to the bottom wherever the reader is: their own send. */
    stickToBottom: () => {
      stick.current = true;
    },
  };
}
