import { SVGProps } from "react";

const paths = {
  overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  ledger:
    "M6 3h12a2 2 0 0 1 2 2v16l-4-2-4 2-4-2-4 2V5a2 2 0 0 1 2-2z M8 8h8 M8 12h5",
  balance: "M12 3v18 M5 6h14 M5 6l-3 7h6L5 6z M19 6l-3 7h6l-3-7z M8 21h8",
  arrow: "M4 12h16 M14 6l6 6-6 6",
  plus: "M12 5v14 M5 12h14",
  chevron: "m8 10 4 4 4-4",
  close: "m6 6 12 12 M6 18 18 6",
  people:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M17 4a4 4 0 0 1 0 7 M22 21v-2a4 4 0 0 0-3-3.87",
  sparkles:
    "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3z M20 2v4 M18 4h4",
  camera:
    "M14 4h-4L8 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4l-2-3z M16 13a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
  coffee: "M4 3h10v10a5 5 0 0 1-10 0V3z M14 4h3a3 3 0 0 1 0 6h-3 M2 21h16",
  home: "m3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8",
  travel: "M4 7h16v13H4z M8 7V4h8v3 M8 11v5 M16 11v5",
  check: "m5 12 4 4L19 6",
  mail: "M3 5h18v14H3z m0 0 9 8 9-8",
  search: "M16 10a6 6 0 1 0-12 0 6 6 0 0 0 12 0 m-2 4 6 6",
} as const;

export default function Icon({
  name,
  ...props
}: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
