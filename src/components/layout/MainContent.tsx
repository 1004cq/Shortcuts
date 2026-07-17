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
      className={cn(
        "flex-1 overflow-y-auto",
        withTabPad
          ? "pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8"
          : "pb-6 md:pb-8",
        "bg-[radial-gradient(ellipse_at_top,_var(--gradient-spotlight)_0%,_transparent_55%)]",
        className
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 md:px-6 md:py-8">
        {children}
      </div>
    </main>
  );
}
