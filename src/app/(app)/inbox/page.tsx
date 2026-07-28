import { Suspense } from "react";
import { InboxClient } from "./inbox-client";

export default function InboxPage() {
  return (
    <Suspense>
      <InboxClient />
    </Suspense>
  );
}
