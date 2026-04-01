import type { GridPosition } from "../core/types";

export interface GridPointerEvent {
  position: GridPosition;
  button: number;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
}

export interface GridPointerButtonEvent {
  position: GridPosition | null;
  button: number;
  isDown: boolean;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
}

type PointerCallback = (event: GridPointerEvent) => void;
type PointerMoveCallback = (position: GridPosition | null) => void;
type PointerButtonCallback = (event: GridPointerButtonEvent) => void;

export class MouseInput {
  private readonly element: HTMLElement;
  private readonly projectToGrid: (clientX: number, clientY: number) => GridPosition | null;
  private readonly pointerCallbacks: PointerCallback[] = [];
  private readonly moveCallbacks: PointerMoveCallback[] = [];
  private readonly buttonCallbacks: PointerButtonCallback[] = [];

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }
    event.preventDefault();

    if (event.pointerId >= 0 && !this.element.hasPointerCapture(event.pointerId)) {
      this.element.setPointerCapture(event.pointerId);
    }

    const position = this.projectToGrid(event.clientX, event.clientY);
    if (position) {
      const payload: GridPointerEvent = {
        position,
        button: event.button,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        ctrlKey: event.ctrlKey,
      };

      for (const callback of this.pointerCallbacks) {
        callback(payload);
      }
    }

    const buttonPayload: GridPointerButtonEvent = {
      position,
      button: event.button,
      isDown: true,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
    };
    for (const callback of this.buttonCallbacks) {
      callback(buttonPayload);
    }
  };

  private readonly onPointerMoveEvent = (event: PointerEvent): void => {
    const position = this.projectToGrid(event.clientX, event.clientY);
    for (const callback of this.moveCallbacks) {
      callback(position);
    }
  };

  private readonly onPointerUpEvent = (event: PointerEvent): void => {
    if (event.button !== 0 && event.button !== 2) {
      return;
    }

    event.preventDefault();

    const position = this.projectToGrid(event.clientX, event.clientY);
    const buttonPayload: GridPointerButtonEvent = {
      position,
      button: event.button,
      isDown: false,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
    };
    for (const callback of this.buttonCallbacks) {
      callback(buttonPayload);
    }

    if (event.pointerId >= 0 && this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
  };

  constructor(element: HTMLElement, projectToGrid: (clientX: number, clientY: number) => GridPosition | null) {
    this.element = element;
    this.projectToGrid = projectToGrid;

    this.element.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("pointermove", this.onPointerMoveEvent);
    this.element.addEventListener("pointerup", this.onPointerUpEvent);
    this.element.addEventListener("pointercancel", this.onPointerUpEvent);
    this.element.addEventListener("contextmenu", this.onContextMenu);
  }

  onPointer(callback: PointerCallback): () => void {
    this.pointerCallbacks.push(callback);
    return () => {
      const index = this.pointerCallbacks.indexOf(callback);
      if (index >= 0) {
        this.pointerCallbacks.splice(index, 1);
      }
    };
  }

  onPointerMove(callback: PointerMoveCallback): () => void {
    this.moveCallbacks.push(callback);
    return () => {
      const index = this.moveCallbacks.indexOf(callback);
      if (index >= 0) {
        this.moveCallbacks.splice(index, 1);
      }
    };
  }

  onButtonState(callback: PointerButtonCallback): () => void {
    this.buttonCallbacks.push(callback);
    return () => {
      const index = this.buttonCallbacks.indexOf(callback);
      if (index >= 0) {
        this.buttonCallbacks.splice(index, 1);
      }
    };
  }

  dispose(): void {
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointermove", this.onPointerMoveEvent);
    this.element.removeEventListener("pointerup", this.onPointerUpEvent);
    this.element.removeEventListener("pointercancel", this.onPointerUpEvent);
    this.element.removeEventListener("contextmenu", this.onContextMenu);
    this.pointerCallbacks.length = 0;
    this.moveCallbacks.length = 0;
    this.buttonCallbacks.length = 0;
  }
}
