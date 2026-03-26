import type { GridPosition } from "../core/types";
import { Tile } from "./Tile";

export class Grid {
  readonly width: number;
  readonly height: number;
  private readonly tiles: Tile[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = Array.from({ length: width * height }, () => new Tile());
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  get(x: number, y: number): Tile | null {
    if (!this.isInBounds(x, y)) {
      return null;
    }
    return this.tiles[y * this.width + x];
  }

  getAt(position: GridPosition): Tile | null {
    return this.get(position.x, position.y);
  }

  forEach(callback: (tile: Tile, x: number, y: number) => void): void {
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const tile = this.tiles[y * this.width + x];
        callback(tile, x, y);
      }
    }
  }
}
