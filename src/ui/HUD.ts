import type { BuildTool, Direction, GridPosition } from "../core/types";
import type { ItemId } from "../data/items";

export interface HudStats {
  fps: number;
  tick: number;
  worldItems: number;
}

export class HUD {
  private readonly root: HTMLDivElement;
  private readonly modeLine: HTMLDivElement;
  private readonly cellLine: HTMLDivElement;
  private readonly statsLine: HTMLDivElement;
  private readonly inventoryLine: HTMLDivElement;
  private readonly controlsLine: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = document.createElement("div");
    this.root.style.position = "fixed";
    this.root.style.left = "12px";
    this.root.style.top = "12px";
    this.root.style.padding = "10px 12px";
    this.root.style.border = "1px solid #3a4758";
    this.root.style.borderRadius = "8px";
    this.root.style.background = "rgba(13, 17, 23, 0.86)";
    this.root.style.color = "#dce7f3";
    this.root.style.font = "12px/1.5 monospace";
    this.root.style.pointerEvents = "none";
    this.root.style.minWidth = "260px";
    this.root.style.backdropFilter = "blur(2px)";

    this.modeLine = document.createElement("div");
    this.cellLine = document.createElement("div");
    this.statsLine = document.createElement("div");
    this.inventoryLine = document.createElement("div");
    this.controlsLine = document.createElement("div");
    this.controlsLine.style.marginTop = "8px";
    this.controlsLine.style.color = "#a6b4c4";
    this.controlsLine.textContent = "1 belt, 2 machine, 3 router, 4 eraser, R rotate, RMB erase, MMB drag, wheel zoom, WASD/arrows pan";

    this.root.append(this.modeLine, this.cellLine, this.statsLine, this.inventoryLine, this.controlsLine);
    parent.appendChild(this.root);
  }

  setBuildMode(tool: BuildTool, direction: Direction): void {
    this.modeLine.textContent = `Tool: ${tool} | Direction: ${direction}`;
  }

  setHoveredCell(position: GridPosition | null): void {
    this.cellLine.textContent = position ? `Cursor: (${position.x}, ${position.y})` : "Cursor: -";
  }

  setStats(stats: HudStats): void {
    this.statsLine.textContent = `FPS: ${stats.fps.toFixed(1)} | Tick: ${stats.tick} | Items on conveyors: ${stats.worldItems}`;
  }

  setInventory(entries: Array<[ItemId, number]>): void {
    if (entries.length === 0) {
      this.inventoryLine.textContent = "Output inventory: empty";
      return;
    }
    const text = entries.map(([itemId, count]) => `${itemId}=${count}`).join(", ");
    this.inventoryLine.textContent = `Output inventory: ${text}`;
  }

  dispose(): void {
    this.root.remove();
  }
}
