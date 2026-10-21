# Design System: shadcn/ui with Opaque Zinc Surfaces

We adopt shadcn/ui (Radix UI primitives + Tailwind v4 CSS variables) as the component foundation, replacing 13 hand-rolled components incrementally. The visual language is opaque zinc surfaces (3-tier ramp: zinc-950 page, zinc-900 card, zinc-900 elevated with zinc-950/80 backdrop), 1px solid zinc-800 borders, no glassmorphism, no backdrop-blur, no decorative box-shadows or glow effects. Accent color (violet-400) appears only on focus rings and active states — semantic colors (emerald for APPLY, amber for REVIEW) carry all visual weight in the pipeline.

## Considered Options

- **shadcn/ui (chosen):** Code-owned Radix primitives styled with Tailwind v4 tokens. Full control, zero runtime dependency, native Next.js App Router compatibility. Matches the Linear/Vercel-style desktop cockpit aesthetic we're targeting.
- **HeroUI (formerly NextUI):** Pre-styled Tailwind-native library on React Aria. Beautiful defaults but opinionated — fights dense custom layouts and ships glassmorphism/blur effects by default, which conflicts with our "opaque surfaces, no blur" constraint.
- **Hand-rolled token system (no library):** Keeps current architecture, adds CSS variables and extracts primitives manually. No new dependency but carries all accessibility, focus management, and animation work ourselves — significant for Sheet, Dialog, Command, and DropdownMenu.

## Consequences

- **Migration is incremental, outside-in:** layout tokens → JobCard → IngestModal (Dialog) → ApplicationTracker → PriorityInbox → Drawers. Each ticket ships a working app. The two massive drawers (ApplicationPreparationDrawer at 59KB, ProfileDrawer at 70KB) come last, after all primitives are battle-tested.
- **Core shadcn component set installed upfront:** Button, Badge, Card, Dialog, Sheet, DropdownMenu, Command (cmdk), Input, Textarea, Tabs, Tooltip, Separator. Available from the start so each migration draws from the full palette.
- **Command palette (⌘K) is part of the design system,** not a later phase. Highest-leverage interaction upgrade for a triage-heavy workflow.
- **Typography:** shadcn defaults (text-sm base, text-xs metadata, font-mono tabular-nums for numeric values). Inter font retained.
- **Animations:** CSS transitions only (Radix built-in data-state animations). No Framer Motion dependency in this phase.
- **Single animate-pulse retained** on the header status dot (functional "system live" indicator). Removed from all badges.
- **Mobile Overlays Addendum:** Compact mobile overlays (`<sm`) and fixed bottom navigation action bars (`MobileActionBar`, `BottomSheet`) are permitted subtle `backdrop-blur` to prevent background bleed-through and ensure contrast against underlying dense tables on small phone viewports. Desktop surfaces remain strictly opaque zinc.
