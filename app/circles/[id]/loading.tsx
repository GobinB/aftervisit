/** Shown inside the circle frame the moment an area is clicked, while its page loads. */
export default function CircleLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Loading</span>
      <div className="h-7 w-40 rounded-md bg-border-200/70" />
      <div className="mt-2 h-4 w-56 rounded bg-border-200/50" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="h-24 rounded-lg border border-border-200 bg-white" />
        ))}
      </div>
      <div className="mt-5 space-y-2 rounded-lg border border-border-200 bg-white p-4">
        {[0, 1, 2, 3].map((n) => (
          <div key={n} className="h-10 rounded bg-paper-100" />
        ))}
      </div>
    </div>
  );
}
