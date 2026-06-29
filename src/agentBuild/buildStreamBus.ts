import { EventEmitter } from "node:events";

export type BuildStreamEventKind =
  | "progress"
  | "todo"
  | "slice_started"
  | "slice_complete"
  | "interrupted"
  | "error";

export type BuildStreamEvent = {
  slug: string;
  kind: BuildStreamEventKind;
  message: string;
  data?: Record<string, unknown>;
};

class BuildStreamBus extends EventEmitter {
  emitEvent(event: BuildStreamEvent): void {
    this.emit("build.stream", event);
  }

  onStream(listener: (event: BuildStreamEvent) => void): () => void {
    this.on("build.stream", listener);
    return () => this.off("build.stream", listener);
  }
}

export const buildStreamBus = new BuildStreamBus();

export function formatBuildStreamMessage(event: BuildStreamEvent): string {
  const prefix =
    event.kind === "todo"
      ? "[build todo]"
      : event.kind === "interrupted"
        ? "[build interrupted]"
        : event.kind === "slice_complete"
          ? "[build slice done]"
          : "[build]";
  return `${prefix} ${event.slug}: ${event.message}`;
}
