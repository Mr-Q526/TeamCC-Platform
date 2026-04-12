import type { ReactNode, SVGProps } from 'react'

type IconName =
  | 'activity'
  | 'arrowDown'
  | 'arrowRight'
  | 'audit'
  | 'close'
  | 'dashboard'
  | 'graph'
  | 'globe'
  | 'logout'
  | 'plus'
  | 'refresh'
  | 'search'
  | 'shield'
  | 'spark'
  | 'templates'
  | 'users'

interface AppIconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

const icons: Record<IconName, ReactNode> = {
  activity: (
    <>
      <path d="M4 13.5h3l2.2-5 3.6 9 2.2-4H20" />
      <path d="M4 6.5h5" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  audit: (
    <>
      <path d="M12 4.75 5.75 7.5V12c0 4.05 2.53 7.33 6.25 8 3.72-.67 6.25-3.95 6.25-8V7.5L12 4.75Z" />
      <path d="m9.5 12.25 1.7 1.7 3.6-3.95" />
    </>
  ),
  close: (
    <>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </>
  ),
  dashboard: (
    <>
      <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="13" y="4.5" width="6.5" height="10.5" rx="1.5" />
      <rect x="4.5" y="13" width="6.5" height="6.5" rx="1.5" />
      <rect x="13" y="16" width="6.5" height="3.5" rx="1.5" />
    </>
  ),
  graph: (
    <>
      <circle cx="6.5" cy="8" r="1.75" />
      <circle cx="17.5" cy="6.5" r="1.75" />
      <circle cx="10.5" cy="17.5" r="1.75" />
      <circle cx="18" cy="16.5" r="1.75" />
      <path d="M8.2 7.75 15.8 6.75" />
      <path d="m7.8 9.1 1.9 6.3" />
      <path d="m12.1 17.2 4.3-.4" />
      <path d="m17.7 8.3.2 6.4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M4.5 12h15" />
      <path d="M12 4a13 13 0 0 1 0 16" />
      <path d="M12 4a13 13 0 0 0 0 16" />
    </>
  ),
  logout: (
    <>
      <path d="M9 20H6.75A1.75 1.75 0 0 1 5 18.25V5.75C5 4.78 5.78 4 6.75 4H9" />
      <path d="M13 16l4-4-4-4" />
      <path d="M9 12h8" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 11.5A7.5 7.5 0 1 1 17 6.1" />
      <path d="M20 4.5v5h-5" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="5.5" />
      <path d="m15.25 15.25 4.25 4.25" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.75 5.5 6.4v5.05c0 4.08 2.66 7.68 6.5 8.8 3.84-1.12 6.5-4.72 6.5-8.8V6.4L12 3.75Z" />
      <path d="M12 8.5v6.5" />
      <path d="M8.75 11.75H15.25" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.65 4.35L18 9l-4.35 1.65L12 15l-1.65-4.35L6 9l4.35-1.65L12 3Z" />
      <path d="m18.5 3 .55 1.45L20.5 5l-1.45.55L18.5 7l-.55-1.45L16.5 5l1.45-.55L18.5 3Z" />
      <path d="m5.5 15 .7 1.8L8 17.5l-1.8.7L5.5 20l-.7-1.8L3 17.5l1.8-.7.7-1.8Z" />
    </>
  ),
  templates: (
    <>
      <path d="M7 4.5h8l4 4v11A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-13A2 2 0 0 1 7 4.5Z" />
      <path d="M15 4.5v4h4" />
      <path d="M8.5 12h7" />
      <path d="M8.5 16h4.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3.75 18.25c1.2-2.65 3.13-4 5.25-4s4.05 1.35 5.25 4" />
      <path d="M16.5 8.25a2.25 2.25 0 1 1 0 4.5" />
      <path d="M17.25 18.25c-.4-1.26-1.12-2.27-2.25-3" />
    </>
  ),
}

export default function AppIcon({
  name,
  size = 18,
  className,
  ...rest
}: AppIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {icons[name]}
    </svg>
  )
}
