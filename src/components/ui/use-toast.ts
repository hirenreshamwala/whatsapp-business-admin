"use client";

// Adapted from shadcn/ui toast hook.
import * as React from "react";
import type { ToastActionElement, ToastProps } from "@/components/ui/toast";

const TOAST_LIMIT = 4;
const TOAST_REMOVE_DELAY = 5000;

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: ToastActionElement;
};

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type State = { toasts: ToasterToast[] };

const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRemoval(id: string) {
  if (timeouts.has(id)) return;
  const t = setTimeout(() => {
    timeouts.delete(id);
    memoryState = { toasts: memoryState.toasts.filter((x) => x.id !== id) };
    listeners.forEach((l) => l(memoryState));
  }, TOAST_REMOVE_DELAY);
  timeouts.set(id, t);
}

function dispatch(next: State) {
  memoryState = next;
  listeners.forEach((l) => l(memoryState));
}

export function toast(props: Omit<ToasterToast, "id">) {
  const id = genId();
  const dismiss = () =>
    dispatch({
      toasts: memoryState.toasts.map((t) => (t.id === id ? { ...t, open: false } : t)),
    });

  dispatch({
    toasts: [
      { ...props, id, open: true, onOpenChange: (open: boolean) => !open && dismiss() },
      ...memoryState.toasts,
    ].slice(0, TOAST_LIMIT),
  });
  scheduleRemoval(id);

  return { id, dismiss };
}

export function useToast() {
  const [state, setState] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setState);
    return () => {
      const i = listeners.indexOf(setState);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return { ...state, toast };
}
