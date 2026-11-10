export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 22 22" aria-hidden>
      <rect x="2" y="3" width="18" height="4" rx="1" fill="#ff5a1f" />
      <rect x="2" y="9" width="18" height="4" rx="1" fill="#ecebe6" opacity="0.85" />
      <rect x="2" y="15" width="18" height="4" rx="1" fill="#ecebe6" opacity="0.45" />
    </svg>
  );
}
