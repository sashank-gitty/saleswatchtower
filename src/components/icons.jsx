// Shared icon set. Every icon is a 24x24 stroked path so they sit on the
// same optical weight as each other at any size, and they all inherit
// `currentColor` so a parent's text color is the only thing that decides
// their tint.

function Icon({ children, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function SparklesIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
      <path d="M12 8.5 13.4 11l2.6 1-2.6 1-1.4 2.5L10.6 13 8 12l2.6-1z" />
    </Icon>
  )
}

export function FeedIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8z" />
    </Icon>
  )
}

export function BriefcaseIcon(props) {
  return (
    <Icon {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
    </Icon>
  )
}

export function AlertIcon(props) {
  return (
    <Icon {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </Icon>
  )
}

export function SlidersIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="10" cy="16" r="2" />
    </Icon>
  )
}

export function SearchIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  )
}

export function HelpIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.3-2.5 3.8" />
      <path d="M12 17.5h.01" />
    </Icon>
  )
}

export function BellIcon(props) {
  return (
    <Icon {...props}>
      <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </Icon>
  )
}

export function ChevronDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="m6 9 6 6 6-6" />
    </Icon>
  )
}

export function ChevronUpIcon(props) {
  return (
    <Icon {...props}>
      <path d="m6 15 6-6 6 6" />
    </Icon>
  )
}

export function ChevronRightIcon(props) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  )
}

export function ChevronLeftIcon(props) {
  return (
    <Icon {...props}>
      <path d="m15 6-6 6 6 6" />
    </Icon>
  )
}

export function DashIcon(props) {
  return (
    <Icon {...props}>
      <path d="M6 12h12" />
    </Icon>
  )
}

export function XIcon(props) {
  return (
    <Icon strokeWidth="2" {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </Icon>
  )
}

export function StarIcon({ filled = false, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="m12 3.8 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </svg>
  )
}

export function TrashIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
    </Icon>
  )
}

export function CopyIcon(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </Icon>
  )
}

export function ExternalLinkIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14 5h5v5M19 5l-7.5 7.5" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </Icon>
  )
}

export function RefreshIcon(props) {
  return (
    <Icon {...props}>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4h-4" />
    </Icon>
  )
}

export function EyeIcon(props) {
  return (
    <Icon {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" />
      <circle cx="12" cy="12" r="3" />
    </Icon>
  )
}

export function DownloadIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 4v10m0 0 4-4m-4 4-4-4" />
      <path d="M5 18h14" />
    </Icon>
  )
}

export function PencilIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17z" />
    </Icon>
  )
}

export function BuildingIcon(props) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01" />
    </Icon>
  )
}

export function MapPinIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11" />
      <circle cx="12" cy="10" r="2.5" />
    </Icon>
  )
}

export function UsersIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2-4.3" />
    </Icon>
  )
}

export function QuoteIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9.5 7A4.5 4.5 0 0 0 5 11.5V17h5v-5.5H7.5A2 2 0 0 1 9.5 9.5z" />
      <path d="M18.5 7A4.5 4.5 0 0 0 14 11.5V17h5v-5.5h-2.5a2 2 0 0 1 2-2z" />
    </Icon>
  )
}

export function TrendUpIcon(props) {
  return (
    <Icon {...props}>
      <path d="m3 16 5.5-5.5 3.5 3.5L21 5" />
      <path d="M15 5h6v6" />
    </Icon>
  )
}

export function LightbulbIcon(props) {
  return (
    <Icon {...props}>
      <path d="M9.5 17h5M10 20.5h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1.1.5 2.1h6c0-1 0-1.7.5-2.1A6 6 0 0 0 12 3" />
    </Icon>
  )
}

export function DocumentIcon(props) {
  return (
    <Icon {...props}>
      <path d="M14 3v5h5" />
      <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
      <path d="M9 13h6M9 17h4" />
    </Icon>
  )
}

export function ChartIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 19h16" />
      <path d="m5 15 4-5 3.5 3L19 6" />
    </Icon>
  )
}

export function NewspaperIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 6h12v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M16 10h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-3" />
      <path d="M7 9h6M7 12h6M7 15h4" />
    </Icon>
  )
}

export function MicIcon(props) {
  return (
    <Icon {...props}>
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </Icon>
  )
}

export function PersonPlusIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="10" cy="8" r="3.2" />
      <path d="M4 19a6 6 0 0 1 12 0" />
      <path d="M18 8v5M15.5 10.5h5" />
    </Icon>
  )
}

export function ScaleIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 4v16M7 20h10" />
      <path d="m5 9 3-4 3 4a3 3 0 0 1-6 0M13 9l3-4 3 4a3 3 0 0 1-6 0" />
    </Icon>
  )
}

export function ArrowUpIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 19V5m0 0-6 6m6-6 6 6" />
    </Icon>
  )
}

export function ArrowDownIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14m0 0 6-6m-6 6-6-6" />
    </Icon>
  )
}

export function SunriseIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 4v3M4.2 11H2M22 11h-2.2M5.6 7.6l1.6 1.6M18.4 7.6l-1.6 1.6" />
      <path d="M6 14a6 6 0 0 1 12 0" />
      <path d="M2 18h20" />
    </Icon>
  )
}

export function PinIcon({ filled = false, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 3a5.5 5.5 0 0 0-5.5 5.5c0 4.2 5.5 12.5 5.5 12.5s5.5-8.3 5.5-12.5A5.5 5.5 0 0 0 12 3z" />
      <circle cx="12" cy="8.5" r="2" />
    </svg>
  )
}

export function MenuIcon(props) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  )
}

export function PlusIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  )
}

export function TargetIcon(props) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </Icon>
  )
}

// The wordmark glyph and the Radar nav icon share this shape — concentric
// sweep arcs plus a blip, standing in for "always scanning for what's
// new" rather than the sparkle/toggle-pill imagery this app used to
// borrow. Original to this app: not a copy of any other product's mark.
export function RadarIcon(props) {
  return (
    <Icon {...props}>
      <path d="M12 12 19 7.5" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
      <path d="M6.5 6.5a8 8 0 1 0 11 11" strokeDasharray="0.5 3.6" strokeLinecap="round" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </Icon>
  )
}
