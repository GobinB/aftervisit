import { AppBar } from "./AppBar";
import { Footer } from "./Footer";

/** Header, content that fills the screen, and a footer that always sits at the bottom. */
export function PageShell({ children, footer = true }: { children: React.ReactNode; footer?: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppBar />
      <div className="flex flex-1 flex-col">{children}</div>
      {footer ? <Footer /> : null}
    </div>
  );
}
