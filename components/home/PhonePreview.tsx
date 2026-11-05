import { Agenda } from "@/components/calendar/Agenda";
import { LogoMark, Wordmark } from "@/components/Logo";
import { TodoList } from "@/components/todos/TodoList";
import { SAMPLE_CALENDAR, SAMPLE_TODOS } from "@/lib/sample-circle";

/**
 * A phone showing the app's own Today screen, drawn by the app's components with fictional data.
 * It is a picture: nothing inside can be focused or clicked, and the caption describes it.
 */
export function PhonePreview({ className = "" }: { className?: string }) {
  return (
    <figure className={`mx-auto w-full max-w-[300px] ${className}`}>
      <div className="rounded-[2.6rem] bg-[#0f1724] p-2.5 shadow-[0_30px_60px_-20px_rgba(15,23,36,0.55)]">
        <div inert aria-hidden="true" className="overflow-hidden rounded-[2.1rem] bg-paper-100">
          <div className="flex items-center justify-between border-b border-border-200 bg-white px-4 pt-5 pb-2.5">
            <span className="flex items-center gap-1.5">
              <LogoMark size={16} />
              <Wordmark className="text-[12px]" />
            </span>
            <span className="rounded border border-attn/40 px-1 text-[8px] font-bold tracking-wider text-attn-ink uppercase">Sample</span>
          </div>
          <div className="space-y-3 px-3 pt-3 pb-4">
            <div>
              <p className="font-display text-[19px] leading-none text-primary-900">Today</p>
              <p className="mt-1 text-[10px] text-ink-500">Margaret Lee · Thursday, October 8</p>
            </div>
            <div className="origin-top-left overflow-hidden rounded-lg border border-border-200 bg-white text-[12px] [zoom:0.78]">
              <Agenda items={SAMPLE_CALENDAR.slice(0, 2)} circleId="sample" canEdit={false} empty="" fromToday={false} />
            </div>
            <div className="overflow-hidden rounded-lg border border-border-200 bg-white [zoom:0.78]">
              <TodoList todos={SAMPLE_TODOS.slice(0, 2)} canEdit={false} />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="sr-only">
        A phone showing a fictional Today screen for Margaret Lee: a cardiology visit that needs someone to go, and two to-dos with who has each one.
      </figcaption>
    </figure>
  );
}
