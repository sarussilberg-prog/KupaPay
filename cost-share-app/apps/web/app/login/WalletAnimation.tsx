'use client';

import styles from './WalletAnimation.module.css';

// Source stage geometry — taken verbatim from the approved KupaPay HTML animation.
const STAGE_W = 1100;
const STAGE_H = 967;
const TOP = { left: 0, top: 247, width: 792, height: 323 };
const BOT = { left: 308, top: 518, width: 792, height: 323 };
const TOP_ENTER = -900;
const TOP_EXIT = 1200;
const BOT_ENTER = 900;
const BOT_EXIT = -1200;

interface WalletAnimationProps {
  /** Square box side in px. Default 148 (matches the mobile ring outer diameter). */
  size?: number;
}

export function WalletAnimation({ size = 148 }: WalletAnimationProps) {
  const k = size / STAGE_W;
  const stageH = STAGE_H * k;
  const stageTop = (size - stageH) / 2;

  return (
    <div
      className={styles.wrap}
      style={{ width: size, height: size }}
      role="img"
      aria-label="KupaPay"
    >
      <div
        className={styles.stage}
        style={{
          top: stageTop,
          width: size,
          height: stageH,
          // CSS custom properties consumed by @keyframes
          ['--top-enter' as string]: `${TOP_ENTER * k}px`,
          ['--top-exit' as string]: `${TOP_EXIT * k}px`,
          ['--bot-enter' as string]: `${BOT_ENTER * k}px`,
          ['--bot-exit' as string]: `${BOT_EXIT * k}px`,
        }}
      >
        {/* Base: the empty teal wallet */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.base}
          src="/brand/anim/wallet-base.png"
          alt=""
          style={{ width: size, height: stageH }}
          draggable={false}
        />

        {/* Clip layer — overflow:hidden so arrows vanish at wallet edges */}
        <div className={styles.clip}>
          {/* Top arrow → slides in from left */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`${styles.arrow} ${styles.arrowTop}`}
            src="/brand/anim/arrow-top.png"
            alt=""
            style={{
              left: TOP.left * k,
              top: TOP.top * k,
              width: TOP.width * k,
              height: TOP.height * k,
            }}
            draggable={false}
          />
          {/* Bottom arrow ← slides in from right */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`${styles.arrow} ${styles.arrowBot}`}
            src="/brand/anim/arrow-bottom.png"
            alt=""
            style={{
              left: BOT.left * k,
              top: BOT.top * k,
              width: BOT.width * k,
              height: BOT.height * k,
            }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
