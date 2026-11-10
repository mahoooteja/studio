"use client";
import { createElement, useEffect, useRef } from "react";

/** Dodaje klasę .in, gdy element wjedzie w viewport. */
export default function Reveal({
  as = "div",
  className = "",
  delay = 0,
  children,
  ...rest
}: {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  delay?: number;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries)
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return createElement(
    as,
    { ...rest, ref, className: `reveal ${className}`, style: { "--d": delay, ...(rest.style || {}) } },
    children,
  );
}

export function SplitHeading({
  lines,
  as = "h2",
  className = "",
}: {
  lines: React.ReactNode[];
  as?: "h1" | "h2";
  className?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("in");
          io.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return createElement(
    as,
    { ref, className },
    lines.map((l, i) => (
      <span className="split-line" key={i} style={{ "--d": i } as React.CSSProperties}>
        <span>{l}</span>
      </span>
    )),
  );
}
