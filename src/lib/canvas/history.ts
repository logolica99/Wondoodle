import { CanvasObject, HistorySnapshot } from "@/types/canvas";
import { cloneObjects } from "./document";

const MAX_HISTORY = 100;

export class HistoryStack {
  private undoStack: HistorySnapshot[] = [];
  private redoStack: HistorySnapshot[] = [];

  push(snapshot: HistorySnapshot) {
    this.undoStack.push({
      objects: cloneObjects(snapshot.objects),
      title: snapshot.title,
    });
    if (this.undoStack.length > MAX_HISTORY) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  undo(
    current: HistorySnapshot
  ): HistorySnapshot | null {
    const previous = this.undoStack.pop();
    if (!previous) return null;
    this.redoStack.push({
      objects: cloneObjects(current.objects),
      title: current.title,
    });
    return previous;
  }

  redo(
    current: HistorySnapshot
  ): HistorySnapshot | null {
    const next = this.redoStack.pop();
    if (!next) return null;
    this.undoStack.push({
      objects: cloneObjects(current.objects),
      title: current.title,
    });
    return next;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export function snapshotFrom(
  objects: CanvasObject[],
  title: string
): HistorySnapshot {
  return {
    objects: cloneObjects(objects),
    title,
  };
}
