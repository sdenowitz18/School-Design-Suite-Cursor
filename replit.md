# Ring Component Design Tool

## Overview

This is an education-focused design tool for school leaders and design partners to manage "Ring Components" — structural elements of a school's learning model. The application provides a canvas-based interface where users can view and interact with components through three main tabs:

1. **Snapshot** — A concise overview answering "What is this?" (definition, purpose, structure, time model, who it serves)
2. **Designed Experience** — Editable view of what students actually experience. Shows description, featured artifacts (dummy), and subcomponents. Each subcomponent has its own aims, practices, supports, and artifacts. Clicking a subcomponent opens a dedicated detail page with breadcrumb navigation. Subcomponents do NOT have sub-subcomponents. Data persists via `designedExperienceData` JSONB with auto-save.
3. **Component Health** — Performance & status view showing how the component is doing (experience/outcomes scores, driver strength, journey status)

Components have types (STEM, Humanities, Wayfinding, Well-being, Cross-cutting) and levels (Course vs Subject for STEM/Humanities), with progressive disclosure adapting the UI based on these selections.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite as the build tool
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state; local React state for UI state
- **UI Components**: shadcn/ui component library (New York style) built on Radix UI primitives
- **Styling**: Tailwind CSS v4 with CSS variables for theming, custom semantic color tokens (outcome, practice, resource colors)
- **Animations**: Framer Motion for canvas interactions and transitions
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`, `@assets/` maps to `attached_assets/`

### Canvas-Based UI
The main interface is a canvas view (`canvas-view.tsx`) where components appear as draggable nodes. Clicking a node opens a side sheet with tabbed views (Snapshot, Designed Experience, Health). Each tab is a separate component file in `client/src/components/`.

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript, executed via tsx
- **API Pattern**: RESTful JSON API under `/api/` prefix
- **Key Endpoints**:
  - `GET/POST /api/components` — list all / create component
  - `GET/PATCH/DELETE /api/components/:nodeId` — single component CRUD
  - `POST /api/seed` — seed default components if none exist
- **Storage Layer**: `IStorage` interface in `server/storage.ts` with `DatabaseStorage` implementation using Drizzle ORM

### Data Storage
- **Database**: PostgreSQL (required, via `DATABASE_URL` environment variable)
- **ORM**: Drizzle ORM with `drizzle-kit` for migrations
- **Schema**: Single `components` table defined in `shared/schema.ts` with:
  - Basic fields: `id` (UUID), `nodeId` (unique text), `title`, `subtitle`, `color`
  - Canvas position: `canvasX`, `canvasY`
  - Three JSONB columns for tab data: `snapshotData`, `designedExperienceData`, `healthData`
- **Schema Push**: `npm run db:push` to sync schema to database
- **Validation**: Zod schemas generated from Drizzle schema via `drizzle-zod`, plus manual Zod schemas for JSONB structures

### Build System
- **Development**: Vite dev server proxied through Express, with HMR via WebSocket
- **Production**: Client built with Vite, server bundled with esbuild into `dist/index.cjs`
- **Build script**: `script/build.ts` handles both client and server builds, with an allowlist of dependencies to bundle (reducing cold start times)

### Design Patterns
- **Shared Schema**: The `shared/` directory contains schema definitions used by both client and server
- **Progressive Disclosure**: UI adapts based on component type and level selections
- **Collapsible Panels**: Heavy use of collapsible/expandable sections to manage information density
- **Side Sheets**: Detail views open as slide-out panels rather than separate pages

## External Dependencies

### Database
- **PostgreSQL**: Required. Connection via `DATABASE_URL` environment variable. Uses `pg` (node-postgres) driver with connection pooling.
- **connect-pg-simple**: Available for session storage (though sessions aren't currently implemented)

### Key NPM Packages
- **drizzle-orm** + **drizzle-kit**: ORM and migration tooling for PostgreSQL
- **@tanstack/react-query**: Server state management and caching
- **framer-motion**: Animation library for canvas interactions
- **recharts**: Chart library (available via shadcn chart component)
- **wouter**: Lightweight client-side router
- **zod**: Runtime validation for API data and form schemas
- **react-day-picker**: Date picker component
- **embla-carousel-react**: Carousel functionality
- **vaul**: Drawer component

### Replit-Specific Integrations
- **@replit/vite-plugin-runtime-error-modal**: Error overlay in development
- **@replit/vite-plugin-cartographer**: Dev tooling (development only)
- **@replit/vite-plugin-dev-banner**: Development banner (development only)
- **vite-plugin-meta-images**: Custom plugin for OpenGraph image meta tags with Replit deployment URLs