"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const COMPACT_VIEWPORT_QUERY = "(max-width: 639px)";
export const SWIPE_DISMISS_DISTANCE_RATIO = 0.25;
export const SWIPE_DISMISS_VELOCITY_PX_PER_MS = 0.5;
export const TACTICAL_DRAWER_CLASS =
  "w-full sm:max-w-3xl lg:max-w-4xl p-0 flex flex-col h-full bg-[#0d0e12] border-l border-[#2a2e38] text-[#f4f2ec] shadow-none gap-0 overflow-hidden";

export type SheetVariant = "bottom-sheet" | "drawer";

export function resolveSheetVariant(isCompactViewport: boolean): SheetVariant {
  return isCompactViewport ? "bottom-sheet" : "drawer";
}

export interface SwipeDismissInput {
  deltaY: number;
  velocityY: number;
  sheetHeight: number;
}

export function shouldDismissBottomSheet({
  deltaY,
  velocityY,
  sheetHeight,
}: SwipeDismissInput): boolean {
  if (deltaY <= 0) return false;
  if (velocityY >= SWIPE_DISMISS_VELOCITY_PX_PER_MS) return true;
  if (sheetHeight <= 0) return false;
  return deltaY >= sheetHeight * SWIPE_DISMISS_DISTANCE_RATIO;
}

function subscribeToCompactViewport(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mediaQueryList = window.matchMedia(COMPACT_VIEWPORT_QUERY);
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

function getCompactViewportSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(COMPACT_VIEWPORT_QUERY).matches;
}

function getCompactViewportServerSnapshot(): boolean {
  return false;
}

export function useIsCompactViewport(): boolean {
  return React.useSyncExternalStore(
    subscribeToCompactViewport,
    getCompactViewportSnapshot,
    getCompactViewportServerSnapshot
  );
}

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  mobileClassName?: string;
  desktopClassName?: string;
}

interface DragState {
  startY: number;
  startedAt: number;
  sheetHeight: number;
}

export default function BottomSheet({
  open,
  onOpenChange,
  children,
  mobileClassName,
  desktopClassName,
}: BottomSheetProps) {
  const isCompact = useIsCompactViewport();
  const variant = resolveSheetVariant(isCompact);
  const isDesktopHidden = Boolean(
    desktopClassName && desktopClassName.split(/\s+/).includes("hidden")
  );

  const contentRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<DragState | null>(null);
  const dragOffsetRef = React.useRef(0);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isSwipeClosing, setIsSwipeClosing] = React.useState(false);

  const clearCloseTimer = React.useCallback(() => {
    if (closeTimerRef.current !== null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const resetDrag = React.useCallback(() => {
    clearCloseTimer();
    dragStateRef.current = null;
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDragging(false);
    setIsSwipeClosing(false);
  }, [clearCloseTimer]);

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        resetDrag();
      } else {
        clearCloseTimer();
        dragStateRef.current = null;
      }
      onOpenChange(nextOpen);
    },
    [clearCloseTimer, onOpenChange, resetDrag]
  );

  React.useEffect(() => clearCloseTimer, [clearCloseTimer]);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch || isSwipeClosing) return;
    dragStateRef.current = {
      startY: touch.clientY,
      startedAt: typeof performance !== "undefined" ? performance.now() : Date.now(),
      sheetHeight: contentRef.current?.getBoundingClientRect().height ?? 0,
    };
    dragOffsetRef.current = 0;
    setDragOffset(0);
    setIsDragging(true);
  }

  function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    const touch = event.touches[0];
    if (!dragState || !touch) return;

    const nextOffset = Math.max(0, touch.clientY - dragState.startY);
    dragOffsetRef.current = nextOffset;
    setDragOffset(nextOffset);
  }

  function handleTouchEnd() {
    const dragState = dragStateRef.current;
    if (!dragState) return;

    const elapsed = Math.max(
      1,
      (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        dragState.startedAt
    );
    const deltaY = dragOffsetRef.current;
    const velocityY = deltaY / elapsed;

    dragStateRef.current = null;
    setIsDragging(false);

    if (
      shouldDismissBottomSheet({
        deltaY,
        velocityY,
        sheetHeight: dragState.sheetHeight,
      })
    ) {
      setIsSwipeClosing(true);
      setDragOffset(dragState.sheetHeight);
      closeTimerRef.current = setTimeout(() => {
        closeTimerRef.current = null;
        onOpenChange(false);
      }, 220);
      return;
    }

    dragOffsetRef.current = 0;
    setDragOffset(0);
  }

  const closeButton = (
    <DialogPrimitive.Close
      aria-label="Close drawer"
      className="absolute right-3.5 top-3.5 z-20 min-h-[36px] min-w-[36px] p-2 rounded-[2px] border border-[#2a2e38] bg-[#1f222a] text-[#f4f2ec] hover:text-[#d4a745] hover:border-[#3d4352] transition-colors flex items-center justify-center focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d4a745]"
    >
      <X className="h-4 w-4 shrink-0" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  );

  // If this bottom sheet is marked hidden on desktop and the viewport is non-compact,
  // do not mount the Radix Dialog at all to prevent focus trapping or pointer-event interception.
  if (!isCompact && isDesktopHidden) {
    return null;
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-[#0d0e12]/70 data-[state=open]:animate-[vanguard-fade-in_200ms_ease-out] data-[state=closed]:animate-[vanguard-fade-out_150ms_ease-in]",
            isCompact && "backdrop-blur-sm",
            !isCompact && isDesktopHidden && "hidden"
          )}
        />
        {variant === "bottom-sheet" ? (
          <DialogPrimitive.Content
            ref={contentRef}
            data-testid="bottom-sheet"
            data-sheet-variant={variant}
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] flex-col gap-0 overflow-hidden rounded-t-[3px] border-t border-[#2a2e38] bg-[#15171d] text-[#f4f2ec] shadow-none pb-[env(safe-area-inset-bottom)]",
              !isSwipeClosing &&
                "data-[state=open]:animate-[vanguard-sheet-in_240ms_cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:animate-[vanguard-sheet-out_200ms_ease-in]",
              mobileClassName
            )}
            style={{
              transform: `translate3d(0, ${dragOffset}px, 0)`,
              transition: isDragging
                ? "none"
                : "transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div
              className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              data-testid="bottom-sheet-drag-handle"
              aria-hidden="true"
            >
              <div className="w-12 h-1 bg-[#2a2e38] rounded-full mx-auto my-2.5" />
            </div>

            {children}

            {closeButton}
          </DialogPrimitive.Content>
        ) : (
          <DialogPrimitive.Content
            ref={contentRef}
            data-testid="responsive-sheet-drawer"
            data-sheet-variant={variant}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col gap-4 border-l border-[#2a2e38] bg-[#0d0e12] p-6 text-[#f4f2ec] shadow-none sm:w-3/4 sm:max-w-2xl lg:max-w-4xl",
              "data-[state=open]:animate-[vanguard-drawer-in_240ms_cubic-bezier(0.22,1,0.36,1)] data-[state=closed]:animate-[vanguard-drawer-out_200ms_ease-in]",
              desktopClassName
            )}
          >
            {children}

            {closeButton}
          </DialogPrimitive.Content>
        )}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
