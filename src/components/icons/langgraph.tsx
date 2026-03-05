export function SaisLogoSVG({
  className,
  width,
  height,
}: {
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 120 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <text
        x="4"
        y="30"
        fontFamily="Inter, system-ui, -apple-system, sans-serif"
        fontWeight="700"
        fontSize="28"
        letterSpacing="-0.02em"
        fill="currentColor"
      >
        SAIS
      </text>
    </svg>
  );
}

/** @deprecated Use SaisLogoSVG instead */
export const LangGraphLogoSVG = SaisLogoSVG;
