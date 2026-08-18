# ADR 0009: Interactive Kanban Pipeline and Drag-and-Drop

## Context

The Application Pipeline tracking view previously rendered all 8 tracking stages in an 8-column CSS grid (`xl:grid-cols-8`). On desktop viewports, this squeezed columns down to ~140px, causing card titles, status badges, preparation triggers, and follow-up draft buttons to squish into an unreadable and barely clickable state.

Furthermore, stage transitions were constrained to a tiny `<select>` dropdown inside each card without intuitive drag-and-drop (DnD) affordance across stages.

## Decision

1. **Horizontal Kanban Rail Layout**:
   - Replace the rigid 8-column grid with a horizontally scrollable Kanban board (`flex overflow-x-auto gap-4`).
   - Give each pipeline column a fixed minimum width (`min-w-[300px] w-[300px]`) so cards have ample horizontal breathing room for badges, timestamps, response time metrics, and actions.
   - Support smooth horizontal scrolling with styled scrollbars and column headers displaying stage-specific color coding and item counters.

2. **Native HTML5 Drag-and-Drop Interaction**:
   - Use native HTML5 Drag and Drop (`draggable`, `onDragStart`, `onDragEnd`, `onDragOver`, `onDragLeave`, `onDrop`) to eliminate external bundle overhead and maintain full React 19 compatibility without peer dependency conflicts.
   - Provide clear visual feedback:
     - Drag source styling (reduced opacity, subtle elevation).
     - Target column active state (highlighted border and stage-tinted background glow during hover).
     - Optimistic UI state updating with background server action execution (`updateJobStatusAction`) and audit event logging.

3. **Hybrid Action Controls**:
   - Retain accessible, keyboard-operable stage transition controls alongside drag-and-drop.
   - Layout card action buttons (Preparation Drawer trigger, Follow-up Email Drafter, Stage Selector) in a spacious, non-overlapping action bar.

## Consequences

- Cards and controls remain fully legible and clickable across all desktop and laptop viewport sizes.
- Users can naturally drag jobs between pipeline stages (e.g., Shortlisted → Prepared → Applied → Interview → Offer → Rejected).
- Zero new runtime npm dependencies required.
