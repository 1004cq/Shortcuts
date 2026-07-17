import { cn } from "@/lib/utils";

type MainContentProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Primary scrollable content pane for dashboard / admin shells.
 */
export function MainContent({ children, className }: MainContentProps) {
  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto pb-24 md:pb-8",
        "bg-[radial-gradient(ellipse_at_top,_var(--gradient-spotlight)_0%,_transparent_55%)]",
        className
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</div>
    </main>
  );
}
