export type Direction = "up" | "right" | "down" | "left";

export type BuildTool = "belt" | "machine" | "router" | "eraser";

export interface GridPosition {
  x: number;
  y: number;
}

export const DIRECTIONS: Direction[] = ["up", "right", "down", "left"];

export const DIRECTION_TO_GRID_OFFSET: Record<Direction, GridPosition> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

export const DIRECTION_TO_WORLD_OFFSET: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: 1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
};

export const rotateDirection = (direction: Direction): Direction => {
  const index = DIRECTIONS.indexOf(direction);
  return DIRECTIONS[(index + 1) % DIRECTIONS.length];
};

export const oppositeDirection = (direction: Direction): Direction => {
  switch (direction) {
    case "up":
      return "down";
    case "right":
      return "left";
    case "down":
      return "up";
    case "left":
      return "right";
  }
};
