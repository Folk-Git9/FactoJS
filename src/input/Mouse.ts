import type { GridPosition } from "../core/types";

export interface GridPointerEvent {
  position: GridPosition;
  button: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
}

type PointerCallback = (event: GridPointerEvent) => void;

export class MouseInput {
  private readonly element: HTMLElement;
  private readonly projectToGrid: (clientX: number, clientY: number) => GridPosition | null;
  private readonly callbacks: PointerCallback[] = [];

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }
    event.preventDefault();
    const position = this.projectToGrid(event.clientX, event.clientY);
    if (!position) {
      return;
    }

    const payload: GridPointerEvent = {
      position,
      button: event.button,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
    };

    for (const callback of this.callbacks) {
      callback(payload);
    }
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  constructor(element: HTMLElement, projectToGrid: (clientX: number, clientY: number) => GridPosition | null) {
    this.element = element;
    this.projectToGrid = projectToGrid;

    this.element.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("contextmenu", this.onContextMenu);
  }

  onPointer(callback: PointerCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const index = this.callbacks.indexOf(callback);
      if (index >= 0) {
        this.callbacks.splice(index, 1);
      }
    };
  }

  dispose(): void {
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("contextmenu", this.onContextMenu);
    this.callbacks.length = 0;
  }
}
