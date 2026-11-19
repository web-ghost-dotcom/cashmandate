import type { SVGProps } from 'react';

type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & { readonly size?: number };

/** All icons share a 20px grid, 1.5px round-capped stroke, and inherit currentColor. */
function IconFrame({ size = 20, children, ...svgProps }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...svgProps}
    >
      {children}
    </svg>
  );
}

export function ArrowUpRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M6 14L14 6M7.5 6H14V12.5" />
    </IconFrame>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4 10H16M11.5 5.5L16 10L11.5 14.5" />
    </IconFrame>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="7" y="7" width="9" height="9" rx="2" />
      <path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4H5.5A1.5 1.5 0 0 0 4 5.5V11.5A1.5 1.5 0 0 0 5.5 13H7" />
    </IconFrame>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M4.5 10.5L8.25 14L15.5 6" />
    </IconFrame>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <circle cx="10" cy="10" r="6.5" />
      <path d="M10 6.5V10L12.5 11.5" />
    </IconFrame>
  );
}

export function CrossIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5" />
    </IconFrame>
  );
}

export function HashIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M7.5 4L6.5 16M13.5 4L12.5 16M4.5 7.5H16M4 12.5H15.5" />
    </IconFrame>
  );
}

export function GavelIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <rect x="3.5" y="4" width="7" height="4.5" rx="1" transform="rotate(35 7 6.25)" />
      <path d="M9.75 8.75L15.5 14.5M4 16.5H11" />
    </IconFrame>
  );
}

export function HourglassIcon(props: IconProps) {
  return (
    <IconFrame {...props}>
      <path d="M5.5 3.5H14.5M5.5 16.5H14.5M6.5 3.5C6.5 7 10 8 10 10C10 12 6.5 13 6.5 16.5M13.5 3.5C13.5 7 10 8 10 10C10 12 13.5 13 13.5 16.5" />
    </IconFrame>
  );
}
