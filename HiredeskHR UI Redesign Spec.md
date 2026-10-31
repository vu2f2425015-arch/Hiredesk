# HiredeskHR UI Redesign Spec

Oct 31, 2026 · @Pankaj

## Design direction

The redesign replaces the crowded top bar and per-page styling with one app shell, one token set and one shared component set. No route, role rule, API call or cache key changes.

This spec works from the repository audit only. Component names, file sizes and routes come from it, and anything the audit does not confirm is marked 'confirm'.

**Principles**

- Quiet by default. Neutral surfaces and one indigo accent, used only for the primary action, the selected item and focus.
- Dense where people work. 40px table rows, 32px controls, cards only for summaries.
- One pattern per job. Every list page is page header, toolbar, table, detail drawer. Every form uses the same footer.
- Status is never color alone. Every badge carries a text label.
- Dark and light come from one token set, so neither drifts.

**What stays**

- Every route and its role guard, Supabase auth, every endpoint in `lib/api.ts`.
- The 8 pipeline stages and their order, the `sessionStorage` cache keys, the `⌘K` and `?` shortcuts, lazy-loaded views.
- React 18, Vite, React Router and plain CSS custom properties. No Tailwind or UI kit is added.

**What changes that is not visual**

- `AuthContext` and `CommandPalette` call `fetch` without `API_BASE`. That breaks split deployments, so it is fixed first.
- The ghost classes `card`, `form-control` and `alert alert-danger` in Interviews and Reports become real components.
- Inline `style={{}}` objects give way to component props and a few utility classes.

## Design tokens

One neutral scale, one indigo accent, one font family. Tokens are defined once on `:root`, with light overrides under `[data-theme='light']`, and the rest of this spec refers to them by name.

### Color

| Token | Dark | Light | Use |
| --- | --- | --- | --- |
| `--bg-canvas` | `#0B0D12` | `#F6F7F9` | App background |
| `--bg-surface` | `#11141B` | `#FFFFFF` | Sidebar, tables, cards, inputs |
| `--bg-raised` | `#171B24` | `#FFFFFF` | Menus, popovers, drawers, modals |
| `--bg-hover` | `#1C212C` | `#F0F2F5` | Row and menu item hover |
| `--border-subtle` | `#1F2430` | `#E6E9EE` | Dividers, table row lines |
| `--border-default` | `#2A3140` | `#D5DAE2` | Inputs, cards, buttons |
| `--border-strong` | `#3A4357` | `#B8C0CC` | Hovered controls |
| `--text-primary` | `#F1F3F7` | `#12151C` | Headings, table text |
| `--text-secondary` | `#A8B0C0` | `#4A5365` | Labels, descriptions |
| `--text-tertiary` | `#8089A0` | `#667085` | Meta text, placeholders |
| `--text-disabled` | `#5B6478` | `#98A2B3` | Disabled controls only |
| `--accent` | `#4F46E5` | `#4F46E5` | Primary button fill, selected bar. White text on it is about 6.3:1 |
| `--accent-hover` | `#5B52EC` | `#4338CA` | Hover on a filled accent |
| `--accent-text` | `#818CF8` | `#4338CA` | Links, active nav label, focus ring |
| `--accent-subtle` | `rgba(129,140,248,0.14)` | `#EEF0FF` | Selected row and nav item |
| `--success` | `#3FCB8E` | `#0F7A53` | Badge text and dot, alert icon |
| `--warning` | `#E5A93C` | `#8A5A00` | Badge text and dot, alert icon |
| `--danger` | `#F27474` | `#B42318` | Badge text and dot, alert icon, destructive buttons |
| `--info` | `#6AA6F8` | `#1D4ED8` | Badge text and dot, alert icon |

- Status badges use a tint of the status color (14% in dark, 10% in light) with a 1px border at 28%. The text stays the full status color.
- These values are targets. Phase 1 checks every text and background pair: text at 4.5:1 or better, borders and focus rings at 3:1. Two pairs in today's CSS fall short: `--text-dim` `#64748B` on `#0A0D14` is about 4.0:1, and white on `#6366F1` is just under 4.5:1.
- Removed: `--accent-cyan`, `--accent-violet`, `--shadow-glow` and background gradients.
- Charts use the accent for the primary series, `--text-tertiary` grey for comparisons and status colors for outcomes. Categories such as sources get at most five muted hues.

### Typography

| Style | Size / line | Weight | Use |
| --- | --- | --- | --- |
| Page title | 24 / 32 | 600 | One per page |
| Section title | 16 / 24 | 600 | Panel, drawer and dialog sections |
| Body | 14 / 20 | 400 | Default text, form fields |
| Table cell | 13 / 20 | 400 | Data tables |
| Label | 12 / 16 | 500 | Column headers, form labels |
| Meta | 12 / 16 | 400 | Timestamps, helper text |
| KPI value | 28 / 32 | 600 | Dashboard numbers |
| Mono | 12.5 / 20 | 500 | Job codes such as JOB-0042 |

Inter (variable, self-hosted) is used for everything, with tabular numbers in tables and KPI values. Outfit and Plus Jakarta Sans go, so the app loads one font instead of two. Mono text uses the system monospace stack. Sentence case throughout, no all-caps labels, and nothing smaller than 12px.

### Space, shape and layout

| Group | Values |
| --- | --- |
| Space | 4px base: `--space-1` 4, `--space-2` 8, `--space-3` 12, `--space-4` 16, `--space-5` 20, `--space-6` 24, `--space-8` 32, `--space-10` 40, `--space-12` 48 |
| Radius | `--radius-sm` 4 (badges), `--radius-md` 6 (buttons, inputs), `--radius-lg` 8 (cards, tables, menus), `--radius-xl` 12 (modals, drawers), `--radius-full` (avatars, count pills). Replaces today's 6 / 10 / 16 |
| Control height | 28 small, 32 default, 40 large (sign-in and public forms). On touch devices the default becomes 44 |
| Table | Header 36, row 40, compact row 32, cell padding 0 12px |
| Elevation | Level 0: border only (cards, tables). Level 1, menus and popovers: `0 4px 16px` at 28% black in dark, 10% in light. Level 2, modals and drawers: `0 16px 48px` at 40% in dark, 16% in light. Backdrop `rgba(5,7,10,0.6)` in dark, `rgba(16,24,40,0.4)` in light |
| Motion | 120ms for hover and focus, 180ms for drawers, menus and toasts. Easing `cubic-bezier(0.2, 0, 0, 1)`. Skeleton pulse 1.4s. Under `prefers-reduced-motion`, slides and pulses are off |
| Z-index | sticky 10, sidebar 20, dropdown 40, drawer 50, modal 60, toast 70, command palette 80. Replaces the ad-hoc 100 and 150 |
| Breakpoints | 640, 768, 1024, 1280, 1536 |
| Layout | Sidebar 232 (56 collapsed), top bar 48, page gutter 24 (16 under 768), content max width 1280. The pipeline board runs full width |
| Focus ring | 2px `--accent-text` with a 2px offset, on every interactive element |

## App shell

Every signed-in page sits in one frame: a left sidebar, a 48px top bar, then a page header, a toolbar and the content. Only the active nav item and the primary action use the accent.

&#91;embedded content: app shell layout · sidebar, top bar, page header, toolbar, table\]

The sidebar and top bar stay fixed. The page header, toolbar and table change with the route.

### Sidebar (232px, 56px collapsed)

| Item | Route | Shown to |
| --- | --- | --- |
| Dashboard | `/` | SUPER\_ADMIN, MANAGER, RECRUITER |
| Jobs | `/jobs` | SUPER\_ADMIN, MANAGER, RECRUITER |
| Talent pool | `/talent-pool` | SUPER\_ADMIN, MANAGER, RECRUITER |
| Interviews | `/interviews` | SUPER\_ADMIN, MANAGER, RECRUITER |
| Reports | `/reports` | SUPER\_ADMIN, MANAGER, RECRUITER |
| Unmatched | `/unmatched` | SUPER\_ADMIN, MANAGER, RECRUITER |
| Client portal | `/client-portal` | CLIENT, SUPER\_ADMIN |

- Nav items are 32px high with 14px labels and 16px Lucide icons. The active item gets `--accent-subtle`, `--accent-text` and `aria-current='page'`. Hover uses `--bg-hover`.
- Top of the sidebar: brand mark and organization name. Bottom: a system status dot (neutral when healthy, amber or red when the health check fails, linking to `/system-status`), a collapse button and the user menu.
- The user menu holds the name and role badge, the theme toggle, the shortcut list and Sign out. The theme toggle leaves the top bar.
- A count badge on Unmatched appears only if the existing list endpoint already returns a total. No new endpoints.

### Top bar (48px)

- Left: a menu button (under 1024px) and the breadcrumbs.
- Right: a search field that opens the existing command palette ('Search or jump to… ⌘K', icon only under 768px), the notification bell, and a help button that opens the shortcut list.
- The `LiveDiagnosticsBar` ticker leaves the bar. Its status becomes the sidebar dot, and the uptime counter moves to `/system-status`.

### Breadcrumbs

- Built from the route: 'Jobs' on the list page, 'Jobs / JOB code' on a job's pipeline. The last crumb is plain text and earlier ones are links.
- Under 768px only the parent shows, as a back link.

### Page header

- Row one: the page title (24/32) with an optional count, and on the right one primary button plus an overflow menu for secondary actions. At most one primary action per page.
- Row two, optional: a one-line description in `--text-secondary`, or tabs.
- The toolbar sits below (48px) with search, filters, sort and the result count. Header and toolbar together take about 120px, so the table starts high on the screen.

## Component hierarchy

Views compose patterns, patterns compose primitives, and every layer reads one token file. The build order follows the stack from the bottom.

&#91;embedded content: component layers · tokens to views, 6 layers\]

Each layer only uses the layers beneath it, so a restyle touches tokens and primitives, not every view.

### Core components

| Component | Variants and rules | Replaces |
| --- | --- | --- |
| `Button` | Primary, secondary, ghost, danger. Sizes sm, md, lg. Loading state, icon slot | Per-page button styles and inline styles |
| `Badge`, `StatusPill` | Neutral, success, warning, danger, info, accent. Dot plus text. One tone map per enum | Ad-hoc colored spans |
| `Input`, `Select`, `Textarea`, `SearchInput` | 32 or 40px. Label, helper and error slots | Global input overrides in `index.css` (lines 238–268) |
| `Modal`, `Drawer` | One dialog: focus trap, Escape, scroll lock, sticky footer | Each view's own overlay and z-index |
| `DataTable` | Sticky header, sortable columns, row menu, compact mode, stacked rows on phones | Hand-built tables in each view |
| `Toolbar`, `FilterBar` | Search, filter chips, sort, count | Per-view filter strips |
| `Pagination` | Range, page size, previous and next | Per-view pagination |
| `Tabs` | Underline style, optional counts | Ad-hoc tab strips in Reports and Client portal |
| `Alert` | Info, success, warning, danger. Inline and form-level | The ghost `alert alert-danger` class |
| `Card` | Border, 16px padding, optional title row | `.glass-card` and the ghost `card` class |
| `EmptyState`, `ErrorState`, `Skeleton` | See States and accessibility | `PageLoadingSkeleton`, generalized |

### Status tones

| Domain | Values and tones |
| --- | --- |
| Application stage | Applied neutral, Screening info, Shortlisted accent, Interview accent, Client Review warning, Selected success, Hired success, Rejected danger |
| Job status | Draft neutral, Published success, Closed neutral |
| Interview | Scheduled info, Completed success, Cancelled neutral, No-show danger |
| Role | Neutral for every role, since roles are labels and not statuses |

Confirm the exact enum values in `packages/shared`. Each enum gets one `statusTone()` map next to it, so no view picks colors itself.

### Folders and file size

- `styles/`: `tokens.css` and `base.css`. Component CSS sits beside each component.
- `components/ui/`: primitives and overlays.
- `components/patterns/`: `DataTable`, `Toolbar`, `PageHeader`, `StatCard`, `EmptyState`, `ErrorState`.
- `components/shell/`: `AppShell`, `Sidebar`, `TopBar`, `Breadcrumbs`.
- `pages/<view>/`: that view's own drawers, dialogs and forms.

A view file keeps data loading and layout only, with a target of about 400 lines. The five files over 1,000 lines (`ClientPortalView`, `AuthView`, `InterviewsView`, `JobsView`, `TalentPoolView`) are the first to split.

Existing components keep their jobs and are restyled with the tokens: `CommandPalette`, `KeyboardShortcutsModal`, `NotificationBell`, `Toast`, `PageLoadingSkeleton`, `BackToTop`, and `CookieBanner` (a compact bar at the bottom edge, not a card). `ThemeToggle` moves into the user menu.

## Page-by-page improvements

Every page keeps its workflow and endpoints. Only layout, components and states change. Columns and fields below are the likely set, so confirm each against the API response before building.

### Dashboard (`/`)

- Header 'Dashboard' with one primary action, Post job. Review inbound and Schedule interview are secondary buttons that go to their existing routes.
- Stat row: active jobs and candidates as stat cards (12px label, 28px value, no icons). The stage breakdown is one segmented bar of the 8 stages with counts underneath.
- No trend arrows unless `/api/analytics/dashboard` already returns a comparison value. No computed or mock deltas.
- Other sections move into bordered panels with a 16px title row. No new data sources.
- Empty organization: the current onboarding steps shown as a checklist with done and not-done states.

### Client portal (`/client-portal`)

- Clients get a reduced shell: one sidebar item, the agency name in the top bar, no recruiter terms.
- Two panes on desktop: jobs on the left, candidates for the selected job on the right. On phones these become two screens with a back link.
- A candidate row opens a drawer with the resume, the recruiter summary and a feedback field. Footer actions: Shortlist (primary), Request interview, Reject (danger, with a confirm step).
- After an action the row badge updates in place and a toast confirms it.
- The 1,664-line file splits into `JobList`, `CandidateList`, `CandidateDrawer` and `ActionBar`.

### Jobs (`/jobs`)

- Header 'Jobs' with a count and one primary action, Create job.
- Toolbar: search (250ms debounce, as today), client select, and status tabs All, Draft, Published, Closed. Confirm the labels against `JobStatus`.
- Table columns from `GET /api/jobs`: code (mono), title, client, status, updated. Add applicants only if the response carries it.
- Row click opens job details in a drawer. The row menu holds Copy code, Open pipeline, Publish, Close, Reopen and Duplicate, shown by status. Close asks for confirmation.
- Create and edit use a 560px drawer with a sticky footer instead of centered modals. `CreateJobDrawer` and `JobDetailDrawer` become their own files.
- Pagination bar at the foot: range ('1–25 of 132'), page size, previous and next. Same `page` and `limit` params.

### Job pipeline (opened from a job)

- Breadcrumb 'Jobs / JOB code'. The header shows the title, a status badge and the job's publish and close actions.
- Board: 8 columns, 280px wide, horizontal scroll, sticky column headers with stage name and count. Hired and Rejected sit at the right end behind a divider.
- Card (about 72px): name at 14/500, one meta line, applied date, and a match score chip when present. Initials avatar at 24px.
- Moving a candidate keeps today's flow, including the reason prompt that `PATCH /api/applications/:id/stage` takes. Each card also gets a 'Move to' menu so the board works without a mouse.
- A board/table toggle uses the same applications data for dense scanning.
- Under 768px the board becomes a stage tab strip over one list.

### Candidate profile (drawer)

- 560px right drawer, full screen on phones. Opens from board cards and talent pool rows.
- Header: name, contact line, stage badge, Move stage menu, resume download.
- Tabs: Overview, Activity (stage history), Notes (recruiter notes and client feedback as two labeled fields), AI match (only when `/api/ai-recruiter/status` says it is on).
- Sticky footer with Save notes, enabled only when something changed. Closing with unsaved notes asks first.
- The resume button shows a loading state while the signed URL is generated.

### Talent pool (`/talent-pool`)

- Folder rail on the left (220px), a select on tablet and phone. New, rename and delete live in a folder menu.
- Toolbar: search, filters for skills, stage and location (shown as removable chips once applied), and a sort select.
- Table: name, top three skills with '+N', location, latest stage, last activity. Confirm against the response.
- Row menu: Add to folder, and Associate with job (a small dialog with a job select). One candidate at a time, as the endpoint works today.
- Row click opens the candidate drawer.

### Interviews (`/interviews`)

- Primary action Schedule interview. Tabs: Upcoming, Pending requests, Completed and cancelled.
- List grouped by day: time, candidate, job, interviewer, status badge, and a Join button for the Meet link.
- Row menu: Reschedule, Cancel, Complete (opens the feedback form), No-show, Retry communication. A failed communication also shows as a warning line on the row.
- Schedule and reschedule share one dialog. The time field names the time zone the times are shown in.
- The ghost classes become `Card`, `Select`, `Input` and `Alert`. A month calendar view waits until the list is done.

### Reports (`/reports`)

- Tabs map to the five endpoints: Funnel, Time to hire, Sources, Productivity, Outcomes.
- Each tab has two or three summary numbers, one chart and one table of the same data. A 'View as table' toggle serves screen readers.
- The funnel is horizontal bars with the count and the share of the previous stage. Direct labels instead of legends when there are 8 bars or fewer.
- A date range control only if the endpoints already accept one.
- Ghost classes are replaced as in Interviews.

### Unmatched applications (`/unmatched`)

- Table: received, sender, subject, failure reason (badge), status, actions.
- Primary row action: Assign to job, a dialog with a searchable job select. Retry and Ignore sit in the menu, and Ignore confirms.
- A detail drawer shows whatever the list endpoint returns for the row.
- The view's own `fetch` calls move into `lib/api.ts`.
- Empty state: 'Nothing to triage. Applications that can't be matched to a job show up here.'

### Sign in, register, reset (`/login`, `/register`)

- One centered 400px card on the canvas, no gradient: logo, title, and a link that switches between sign in and register.
- 40px inputs with labels above, a show/hide password toggle, correct `autocomplete` values, validation on blur, and a summary alert for server errors.
- Registration groups the fields under 'You' and 'Your agency'. The fields are exactly today's.
- After sign-up, a 'Check your email' panel with a resend link, if the Supabase flow requires email confirmation. Confirm.
- The 1,211-line `AuthView` splits into `AuthLayout`, `SignInForm`, `RegisterForm` and `ResetForm`.

### Public careers (`/career/:orgSlug`, `/career/:orgSlug/:jobCode`)

- Follows the visitor's system theme. Agency name in the header, a search box, and jobs as rows (title plus the fields the API returns), not cards.
- Job detail on desktop: description on the left at a readable 680px, a sticky 360px apply panel on the right. On phones the form sits below, with a sticky Apply button that scrolls to it.
- Form: name, email, phone, and a resume drop zone with a keyboard-reachable 'Choose file' button. The 10MB limit and accepted types show before upload.
- The honeypot stays hidden from sight and from assistive tech (`tabindex=-1`, `aria-hidden`).
- Success replaces the form with a confirmation. Errors keep what was typed.
- Replace `og-preview.svg` with a 1200×630 PNG so shared links show a preview.

### System status (`/system-status`)

- One panel per check, with a status dot plus text, the last-checked time, and response time if the API gives it.
- The uptime counter moves here from the top bar. Auto-refresh stays as it is.

## Interaction and responsive behavior

The layout changes at four widths, and the rules below apply the same way on every page.

| Width | Shell | Tables | Pipeline board | Drawers and dialogs |
| --- | --- | --- | --- | --- |
| 1280 and up | Sidebar expanded (232px) | All columns | 8 columns, horizontal scroll | 560px right drawer |
| 1024 to 1279 | Sidebar collapsed to icons (56px) with tooltips | Lowest-priority column hidden | Same | 520px right drawer |
| 768 to 1023 | Sidebar becomes an off-canvas menu from a top bar button | 3 to 4 key columns, the rest on a second line | Stage tab strip over one list | 80% width drawer |
| Under 768 | Top bar: menu, page title, search icon, bell | Stacked rows (title, meta, badge), no sideways scrolling | Same as tablet | Full-screen sheet with sticky footer, 44px targets |

The sidebar remembers collapsed or expanded in `localStorage`. Between 1024 and 1279 it starts collapsed.

### Rules that apply everywhere

- **Focus.** A 2px ring (`--accent-text`, 2px offset) on every interactive element. Outlines are never removed. A 'Skip to content' link comes first in the tab order.
- **Dialogs and drawers.** One shared component: focus moves in, is trapped, Escape closes, focus returns to the trigger, and the page behind does not scroll. If the form has unsaved changes, Escape and backdrop click ask before closing.
- **Menus and popovers.** Arrow keys move, type-ahead selects, Escape closes. The notification bell and user menu use the same popover.
- **Tables.** Real `<table>` markup, sticky header, sortable headers with `aria-sort`. A row opens its drawer on click and on Enter. Controls inside a row do not trigger the row.
- **Search.** 250ms debounce (as today), a clear button, Escape clears. Results keep the filters; 'No results' offers 'Clear filters'.
- **Forms.** Labels above fields, validation on blur and on submit, the error text under the field with `aria-describedby`, and the first invalid field focused after a failed submit. The submit button shows a spinner and keeps its width.
- **Toasts.** Bottom right on desktop, top center on phones. Success and info close after 4 seconds, errors stay until dismissed. At most three at once.
- **Shortcuts.** `⌘K` or `Ctrl+K` for the command palette and `?` for the shortcut list, as today. Optional: `/` focuses the page search.
- **Confirmations.** Needed for Close job, Reject, Cancel interview and Ignore. Everything else acts immediately and confirms with a toast.

## States and accessibility

Every list, form and panel needs five states: loading, empty, error, success and no access. These patterns are shared components, not per-page work.

| State | Pattern | Rules |
| --- | --- | --- |
| Loading, first visit | Skeleton shaped like the final layout (5 table rows, 3 cards per board column) | Appears only after 150ms to avoid a flash. Generalizes `PageLoadingSkeleton`. Page-level spinners are not used |
| Loading, cached | Cached content shows at once, then refreshes | Keeps the existing `sessionStorage` caches. No layout shift on refresh |
| Action in progress | Button spinner, button disabled, same width | Row or card shows a pending state while its request runs |
| Empty, nothing yet | `EmptyState`: neutral 16px icon, 15px title, one sentence, one primary action if the user can act | No illustrations. Example: 'No jobs yet. Create your first job.' |
| Empty, filtered | 'No jobs match your filters' with a Clear filters button | Filters stay visible above |
| Error, page | `ErrorState` in the content area: what failed, a Retry button, a link to System status | The shell stays usable |
| Error, form | Message under the field, plus an alert at the top of the form for server errors (`role='alert'`) | Entered values are never cleared |
| Success, small action | Toast naming what happened ('Candidate shortlisted') | 4 seconds, then gone |
| Success, key flow | Full-panel confirmation (apply to a job, register) | Says what happens next |
| No access or not found | Plain page with a link to the user's home route | Reached when a role guard redirects or the route is unknown |
| API unreachable | Banner under the top bar: 'Can't reach the server. Retrying.' | Driven by the existing health check |

### Accessibility checks

- **Contrast.** Text 4.5:1 or better, borders and focus rings 3:1, in both themes. Checked pair by pair in Phase 1.
- **Structure.** Landmarks for navigation, header and main. One `h1` per page, which is the page title, and headings in order.
- **Not color alone.** Every status has a text label. Icon-only buttons have an `aria-label` and a tooltip.
- **Targets.** At least 24px on desktop, 44px on touch devices.
- **Motion.** `prefers-reduced-motion` turns off slides and pulses. Fades stay.
- **Zoom.** Usable at 200% without sideways page scrolling. Tables and the board scroll inside a labeled, focusable region.
- **Forms.** Visible labels (no placeholder-only fields), `autocomplete` values, errors linked to fields.
- **How to test.** A keyboard-only pass over sign-in, Jobs, the candidate drawer and the interview dialog. An axe or Lighthouse run per page. A screen reader spot check (VoiceOver or NVDA) on sign-in and the Jobs table.

## Implementation plan

The work runs in ten phases on the existing `ui/redesign` branch. Each phase ships on its own and leaves the app working, because a compatibility layer keeps old class names reading the new tokens until their page is redone.

| # | Phase | Scope | Done when |
| --- | --- | --- | --- |
| 0 | Safety (done) | Branch `ui/redesign` created, working tree clean, audit written | No code changed |
| 1 | Fixes and tokens | `API_BASE` in `AuthContext` and `CommandPalette`. New `tokens.css`. Remove the `!important` input rules, cyan, violet, glow and gradients. One font. Compatibility layer | App looks nearly the same. Sign-in and every fetch work against a deployed API URL. Typecheck and build pass |
| 2 | Primitives and overlays | `components/ui`: Button, IconButton, Input, Select, Textarea, SearchInput, Checkbox, Badge, StatusPill, Avatar, Skeleton, Tabs, Tooltip, Alert, Modal, Drawer, Popover, DropdownMenu. Toast restyled. A dev-only `/dev/ui` page shows each in every state and both themes | Every component checked in both themes. Keyboard pass on Modal, Drawer and menus |
| 3 | App shell | `AppShell`, `Sidebar`, `TopBar`, `Breadcrumbs`, `PageHeader`. Health ticker becomes a footer dot. Role-based nav. Old pages render inside the shell unchanged | Every route loads in the shell. A CLIENT user sees only Client portal. Checked at 375, 768 and 1280 |
| 4 | Sign-in and public pages | Split `AuthView`, rebuild public careers and system status. These need primitives only, not the shell | Register, sign in, reset and apply-to-job work end to end. Share-preview PNG in place |
| 5 | Dashboard and Jobs | `DataTable`, `Toolbar`, `FilterBar`, `Pagination`, `StatCard`, `EmptyState`, `ErrorState`. Split `JobsView`; add `CreateJobDrawer` and `JobDetailDrawer` | Job lifecycle works: create, publish, appears on the career page, close, reopen |
| 6 | Pipeline and candidate drawer | Board, cards, table toggle, `CandidateDrawer` | A candidate moves from Applied to Hired with reasons saved. Notes persist |
| 7 | Talent pool and Unmatched | Folder rail, filters, associate dialog. Inbound triage, with its `fetch` calls moved into `lib/api.ts` | Folder and associate flows work. An unmatched item can be assigned, retried and ignored |
| 8 | Interviews and Client portal | Interview list, shared schedule dialog, ghost classes removed. Client portal split into its parts | Schedule, reschedule, cancel and complete work. A client sees only the portal and can shortlist, reject and request an interview |
| 9 | Reports | Tabs, charts, 'View as table', ghost classes removed | All five reports load and each table matches its chart |
| 10 | Final QA | Every page in both themes at 375, 768 and 1280. Keyboard pass. axe run. Remove the compatibility layer and dead CSS | No `!important` input rules, no ghost classes, no leftover inline style objects. Accessibility score of 95 or higher per page |

### Working rules

Each phase is one pull request into `ui/redesign`, small enough to review in one sitting. Before merging: `npm run typecheck`, `npm run build --workspace=@hiredesk/web`, the audit's end-to-end checklist for the flows that phase touched, and screenshots at 375, 768 and 1280 in both themes. `lib/api.ts` should show no changes except the calls Phase 7 moves in.

Vercel builds a preview for every push to `ui/redesign`. Those preview URLs sit behind a Vercel login unless Deployment Protection is off for previews, so decide that before sharing a link.

### Decisions before Phase 2

- **Behavior library.** Radix primitives (Dialog, DropdownMenu, Popover, Tabs, Tooltip), unstyled and skinned with the tokens above, or hand-built. Recommended: Radix. The audit found modals with inconsistent Escape handling and no scroll lock, and focus trapping is easy to get wrong. The cost is five small dependencies.
- **Font hosting.** `@fontsource-variable/inter`, self-hosted.
- **Interview calendar.** List first, month view later.
- **Tests.** The audit mentions only typecheck and build. A small Playwright smoke suite for the six end-to-end flows would protect the redesign. Optional.
- **Page specs.** They rest on the audit's summary of each view, so confirm columns and fields at the start of each phase.
