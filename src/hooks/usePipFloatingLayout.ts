"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";

export type PipFloatingLayout = {
  mode: "top-right" | "above-zoom" | "bottom-sheet";
  wrapper: CSSProperties;
  panelAbove: boolean;
  panelMaxHeight: number;
  launcherSize: number;
  /** Full-width panel (portrait compact sheet). */
  fullWidthPanel: boolean;
};

const GAP = 16;
const NAV_CLEARANCE = 92;
const ZOOM_BLOCK = 64;
const LAUNCHER = 68;

function computeLayout(vw: number, vh: number): PipFloatingLayout {
  const edge = GAP;
  const portrait = vh >= vw;
  const short = vh < 720;
  const narrow = vw < 700;
  const spaceBelowNav = vh - NAV_CLEARANCE - LAUNCHER - GAP - edge;

  // Desktop / landscape with room: right edge under the top nav (clear of zoom).
  if (!portrait && !narrow && spaceBelowNav >= 220) {
    return {
      mode: "top-right",
      wrapper: {
        top: NAV_CLEARANCE,
        right: `max(${edge}px, env(safe-area-inset-right, 0px))`,
      },
      panelAbove: false,
      panelMaxHeight: Math.min(420, Math.max(180, spaceBelowNav - GAP)),
      launcherSize: LAUNCHER,
      fullWidthPanel: false,
    };
  }

  // Portrait / tight viewports: sit above zoom controls; panel opens upward.
  const bottomOffset = edge + ZOOM_BLOCK + GAP;
  const availableUp = vh - bottomOffset - LAUNCHER - NAV_CLEARANCE;
  const sheet = narrow && (portrait || short);

  return {
    mode: sheet ? "bottom-sheet" : "above-zoom",
    wrapper: {
      bottom: `max(${bottomOffset}px, calc(env(safe-area-inset-bottom, 0px) + ${ZOOM_BLOCK + GAP}px))`,
      right: `max(${edge}px, env(safe-area-inset-right, 0px))`,
      ...(sheet
        ? { left: `max(${edge}px, env(safe-area-inset-left, 0px))` }
        : {}),
    },
    panelAbove: true,
    panelMaxHeight: Math.min(360, Math.max(160, availableUp - GAP)),
    launcherSize: LAUNCHER,
    fullWidthPanel: sheet,
  };
}

/**
 * Viewport-aware Pip placement — keeps ≥16px from zoom controls and nav.
 */
export function usePipFloatingLayout(expanded: boolean): PipFloatingLayout {
  const [layout, setLayout] = useState<PipFloatingLayout>(() =>
    typeof window === "undefined"
      ? {
          mode: "top-right",
          wrapper: { top: NAV_CLEARANCE, right: GAP },
          panelAbove: false,
          panelMaxHeight: 360,
          launcherSize: LAUNCHER,
          fullWidthPanel: false,
        }
      : computeLayout(window.innerWidth, window.innerHeight)
  );

  useEffect(() => {
    let frame = 0;
    const apply = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setLayout(computeLayout(window.innerWidth, window.innerHeight));
      });
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, [expanded]);

  return layout;
}
