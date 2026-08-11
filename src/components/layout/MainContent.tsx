import { cn } from "@/lib/utils";

type MainContentProps = {
  children: React.ReactNode;
  className?: string;
  withTabPad?: boolean;
};

/**
 * Primary scrollable content pane for dashboard shells.
 */
export function MainContent({
  children,
  className,
  withTabPad = true,
}: MainContentProps) {
  return (
    <main
      data-scroll-root
      className={cn(
        "scroll-root min-h-0 flex-1 overflow-x-hidden overflow-y-auto",
        withTabPad
          ? "pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-8"
          : "pb-6 md:pb-8",
        "bg-[radial-gradient(ellipse_at_top,_var(--gradient-spotlight)_0%,_transparent_55%)]",
        className
      )}
    >
      <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-3 sm:px-5 sm:py-6 md:px-6 md:py-8 lg:px-8">
        {children}
      </div>
    </main>
  );
}
