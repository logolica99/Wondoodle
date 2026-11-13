/** Restrained storybook accents in the journey SVG coordinate system. */
export function MapDecorations() {
  return (
    <g aria-hidden opacity={0.9}>
      {/* Soft clouds */}
      <g fill="#E8F4FF">
        <ellipse cx="320" cy="118" rx="38" ry="16" />
        <ellipse cx="300" cy="122" rx="22" ry="12" />
        <ellipse cx="342" cy="122" rx="20" ry="11" />
        <ellipse cx="860" cy="400" rx="42" ry="15" />
        <ellipse cx="838" cy="404" rx="20" ry="11" />
        <ellipse cx="882" cy="404" rx="18" ry="10" />
      </g>

      {/* Tiny stars */}
      <g fill="#FFD66D">
        <path d="M140 240 l3.2 6.6 7.2.8-5.4 4.8 1.5 7-6.5-3.8-6.5 3.8 1.5-7-5.4-4.8 7.2-.8z" />
        <path d="M700 300 l2.4 5 5.4.6-4 3.6 1.1 5.3-4.9-2.9-4.9 2.9 1.1-5.3-4-3.6 5.4-.6z" />
        <path d="M520 140 l2 4.2 4.6.5-3.4 3.1.9 4.5-4.1-2.4-4.1 2.4.9-4.5-3.4-3.1 4.6-.5z" />
      </g>

      {/* Light doodle strokes near the trail */}
      <g
        fill="none"
        stroke="#FF91B6"
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity={0.55}
      >
        <path d="M400 360 c8 12, 22 14, 34 6" />
        <path d="M640 220 c10 -8, 24 -6, 32 6" />
      </g>
      <g
        fill="none"
        stroke="#76B8FF"
        strokeWidth="2.2"
        strokeLinecap="round"
        opacity={0.5}
      >
        <path d="M210 420 c6 10, 18 12, 28 4" />
      </g>
    </g>
  );
}
