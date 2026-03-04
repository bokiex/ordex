# Frontend

**Status:** Shell only — no Ordex-specific UI yet (ORD-9 is backlog)

## Route Structure

```
__root__  (src/routes/__root.tsx)
│   HTML shell, <head>, <body>, <Header />, <HeroUIProvider>, TanStack devtools
│
└── /  (src/routes/index.tsx)
    TanStack Start template homepage (feature cards) — placeholder
```

## Components

### `Header` (`src/components/Header.tsx`)
- Dark-themed top bar with hamburger menu
- Slide-in sidebar using Framer Motion
- Currently only has "Home" link
- Uses Lucide React icons (Menu, X, Home)

## Styling

### `src/styles.css`
- Tailwind CSS v4 with `@import "tailwindcss"`
- HeroUI plugin via `@plugin "./hero"` (references `src/hero.ts`)

### `src/hero.ts`
- Exports HeroUI Tailwind plugin with `addCommonColors: true`

## UI Libraries Available

| Library | Version | Status |
|---------|---------|--------|
| HeroUI | 2.8.9 | Installed, provider wired in `__root__` |
| Framer Motion | 12.34.4 | Installed, used in Header sidebar |
| Lucide React | 0.545.0 | Installed, used in Header |
| Tailwind CSS v4 | 4.1.18 | Configured |

## Root Layout (`src/routes/__root.tsx`)
- Sets up HTML document with meta tags
- Wraps app in `<HeroUIProvider>`
- Includes TanStack Router + Query devtools
- Renders `<Header />` above outlet

## Router Config (`src/router.tsx`)
- `scrollRestoration: true`
- `defaultPreload: "intent"`
- `defaultPreloadStaleTime: 0`

## Dev Server
```bash
bun run dev  # Starts on port 3000
```
