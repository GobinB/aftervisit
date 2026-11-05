"use client";

import { useEffect, useState } from "react";

/** Today's date in the viewer's own time zone. Drawn after load so the server's clock never shows. */
export function TodayDate() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
  }, []);
  return <span suppressHydrationWarning>{label}</span>;
}
