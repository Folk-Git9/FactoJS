import { DIRECTIONS, oppositeDirection, type Direction } from "../core/types";
import type { ItemId } from "../data/items";
import {
  compileProgrammableRouterProgram,
  formatProgrammableRouterRuntimeError,
  type CompiledProgrammableRouterProgram,
} from "../scripting/ProgrammableRouterRuntime";
import type { ConveyorNode, ConveyorRoutingOptions } from "./Conveyor";
import type { Item } from "./Item";

const DEFAULT_PROGRAM_SOURCE = `// Optional JS hook for this router.
// Keep it empty to preserve normal round-robin routing.
//
// Example filter:
// if (api.item() === "iron_ore") {
//   api.allow("up");
//   api.setStatus("Iron -> UP");
// } else if (api.item() === "coal_ore") {
//   api.allow("down");
//   api.setStatus("Coal -> DOWN");
// } else {
//   api.prioritize("right");
// }`;

export interface RouterUiState {
  direction: Direction;
  storedItem: ItemId | null;
  storedProgress: number;
  inputSide: Direction;
  programSource: string;
  programVersion: number;
  activeProgramVersion: number | null;
  compileError: string | null;
  runtimeError: string | null;
  statusText: string;
  lastDecisionItem: ItemId | null;
  lastDecisionInputSide: Direction | null;
  lastDecisionOutputs: Direction[];
}

interface WorldStats {
  tick: number;
  time: number;
}

interface PendingRouterDecision {
  nextState: Record<string, unknown>;
  statusText: string | null;
}

interface EvaluatedRouterDecision extends PendingRouterDecision {
  outputs: Direction[];
}

interface RouterProgramSelection {
  allowed: Set<Direction> | null;
  blocked: Set<Direction>;
  prioritized: Direction[];
  statusText: string | null;
}

interface RouterProgramApi {
  item(): ItemId;
  inputSide(): Direction;
  facing(): Direction;
  outputs(): Direction[];
  allow(value: unknown): Direction[];
  block(value: unknown): Direction[];
  prioritize(value: unknown): Direction[];
  setStatus(text: unknown): void;
  getTick(): number;
  getTime(): number;
}

const isDirection = (value: unknown): value is Direction => {
  return value === "up" || value === "right" || value === "down" || value === "left";
};

const normalizeDirectionList = (value: unknown): Direction[] => {
  if (Array.isArray(value)) {
    const normalized: Direction[] = [];
    for (const entry of value) {
      if (isDirection(entry) && !normalized.includes(entry)) {
        normalized.push(entry);
      }
    }
    return normalized;
  }

  if (isDirection(value)) {
    return [value];
  }

  return [];
};

const cloneStateValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneStateValue(entry));
  }

  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    const cloned: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      cloned[key] = cloneStateValue(entry);
    }
    return cloned;
  }

  return value;
};

const cloneStateRecord = (state: Record<string, unknown>): Record<string, unknown> => {
  return cloneStateValue(state) as Record<string, unknown>;
};

const buildOutputDirections = (
  defaultOutputs: Direction[],
  selection: RouterProgramSelection
): Direction[] => {
  const allowedBase = selection.allowed
    ? defaultOutputs.filter((direction) => selection.allowed?.has(direction) ?? false)
    : [...defaultOutputs];

  const filtered = allowedBase.filter((direction) => !selection.blocked.has(direction));
  const ordered: Direction[] = [];

  for (const direction of selection.prioritized) {
    if (filtered.includes(direction) && !ordered.includes(direction)) {
      ordered.push(direction);
    }
  }

  for (const direction of filtered) {
    if (!ordered.includes(direction)) {
      ordered.push(direction);
    }
  }

  return ordered;
};

export class Router implements ConveyorNode {
  readonly kind = "router";
  direction: Direction;
  speedTilesPerSecond: number;
  item: Item | null;
  progress: number;
  entryDirection: Direction;

  private readonly getWorldStats: () => WorldStats;
  private nextOutputCursor = 0;
  private programSource = DEFAULT_PROGRAM_SOURCE;
  private programVersion = 0;
  private activeProgramVersion: number | null = null;
  private compileError: string | null = null;
  private runtimeError: string | null = null;
  private statusText = "Round-robin";
  private activeProgram: CompiledProgrammableRouterProgram | null = null;
  private state: Record<string, unknown> = {};
  private pendingDecision: PendingRouterDecision | null = null;
  private lastDecisionItem: ItemId | null = null;
  private lastDecisionInputSide: Direction | null = null;
  private lastDecisionOutputs: Direction[] = [];

  constructor(
    direction: Direction,
    getWorldStats: () => WorldStats = () => ({ tick: 0, time: 0 }),
    speedTilesPerSecond = 2,
    initialProgramSource = DEFAULT_PROGRAM_SOURCE
  ) {
    this.direction = direction;
    this.getWorldStats = getWorldStats;
    this.speedTilesPerSecond = speedTilesPerSecond;
    this.item = null;
    this.progress = 0;
    this.entryDirection = oppositeDirection(direction);
    this.applyProgramSource(initialProgramSource);
  }

  canAcceptItem(): boolean {
    return this.item === null;
  }

  acceptItem(item: Item, progress = 0, entryDirection = oppositeDirection(this.direction)): void {
    this.item = item;
    this.progress = Math.min(Math.max(progress, 0), 0.99);
    this.entryDirection = entryDirection;
  }

  releaseItem(): Item | null {
    const released = this.item;
    this.item = null;
    this.progress = 0;
    this.entryDirection = oppositeDirection(this.direction);
    this.pendingDecision = null;
    return released;
  }

  getOutputDirections(
    entryDirection: Direction,
    itemType: Item["type"] | undefined = this.item?.type,
    options: ConveyorRoutingOptions = {}
  ): Direction[] {
    const defaultOutputs = this.getDefaultOutputDirections(entryDirection);
    if (!itemType || !this.activeProgram || this.runtimeError) {
      if (!options.preview) {
        this.pendingDecision = null;
        this.recordDecision(itemType ?? null, entryDirection, defaultOutputs);
      }
      return defaultOutputs;
    }

    const programState = cloneStateRecord(this.state);
    const selection: RouterProgramSelection = {
      allowed: null,
      blocked: new Set<Direction>(),
      prioritized: [],
      statusText: null,
    };

    try {
      this.activeProgram.execute(
        this.createApi(itemType, entryDirection, defaultOutputs, selection),
        programState
      );
    } catch (error) {
      if (!options.preview) {
        this.runtimeError = formatProgrammableRouterRuntimeError(error);
        this.statusText = "Script error, using default routing";
        this.pendingDecision = null;
        this.recordDecision(itemType, entryDirection, defaultOutputs);
      }
      return defaultOutputs;
    }

    const outputs = buildOutputDirections(defaultOutputs, selection);
    if (!options.preview) {
      this.pendingDecision = {
        nextState: programState,
        statusText: selection.statusText,
      };
      this.recordDecision(itemType, entryDirection, outputs);
    }
    return outputs;
  }

  onItemDispatched(outputDirection: Direction): void {
    const candidates = this.getCandidates(this.entryDirection);
    if (candidates.length === 0) {
      this.direction = outputDirection;
      this.commitPendingDecision();
      return;
    }

    const outputIndex = candidates.indexOf(outputDirection);
    if (outputIndex >= 0) {
      this.nextOutputCursor = (outputIndex + 1) % candidates.length;
    }
    this.direction = outputDirection;
    this.commitPendingDecision();
  }

  applyProgramSource(source: string): { ok: boolean; error: string | null } {
    const normalizedSource = source.replace(/\r\n/g, "\n");
    const compileResult = compileProgrammableRouterProgram(normalizedSource);
    this.programSource = normalizedSource;
    this.programVersion += 1;
    this.compileError = compileResult.error;

    if (!compileResult.ok || !compileResult.program) {
      this.statusText = this.activeProgram ? "Compile failed, previous build still routing" : "Compile failed";
      return {
        ok: false,
        error: this.compileError,
      };
    }

    this.activeProgram = compileResult.program;
    this.activeProgramVersion = this.programVersion;
    this.compileError = null;
    this.runtimeError = null;
    this.statusText = "Script ready";
    this.state = {};
    this.pendingDecision = null;
    this.lastDecisionItem = null;
    this.lastDecisionInputSide = null;
    this.lastDecisionOutputs = [];

    return {
      ok: true,
      error: null,
    };
  }

  get debugState(): RouterUiState {
    return {
      direction: this.direction,
      storedItem: this.item?.type ?? null,
      storedProgress: this.progress,
      inputSide: oppositeDirection(this.entryDirection),
      programSource: this.programSource,
      programVersion: this.programVersion,
      activeProgramVersion: this.activeProgramVersion,
      compileError: this.compileError,
      runtimeError: this.runtimeError,
      statusText: this.statusText,
      lastDecisionItem: this.lastDecisionItem,
      lastDecisionInputSide: this.lastDecisionInputSide,
      lastDecisionOutputs: [...this.lastDecisionOutputs],
    };
  }

  static get defaultProgramSource(): string {
    return DEFAULT_PROGRAM_SOURCE;
  }

  private getDefaultOutputDirections(entryDirection: Direction): Direction[] {
    const candidates = this.getCandidates(entryDirection);
    if (candidates.length === 0) {
      return [this.direction];
    }

    const start = this.nextOutputCursor % candidates.length;
    return [...candidates.slice(start), ...candidates.slice(0, start)];
  }

  private getCandidates(entryDirection: Direction): Direction[] {
    const backDirection = oppositeDirection(entryDirection);
    return DIRECTIONS.filter((direction) => direction !== backDirection);
  }

  private createApi(
    itemType: ItemId,
    entryDirection: Direction,
    defaultOutputs: Direction[],
    selection: RouterProgramSelection
  ): RouterProgramApi {
    return {
      item: () => itemType,
      inputSide: () => oppositeDirection(entryDirection),
      facing: () => this.direction,
      outputs: () => buildOutputDirections(defaultOutputs, selection),
      allow: (value) => {
        selection.allowed = new Set(
          normalizeDirectionList(value).filter((direction) => defaultOutputs.includes(direction))
        );
        return buildOutputDirections(defaultOutputs, selection);
      },
      block: (value) => {
        for (const direction of normalizeDirectionList(value)) {
          if (defaultOutputs.includes(direction)) {
            selection.blocked.add(direction);
          }
        }
        return buildOutputDirections(defaultOutputs, selection);
      },
      prioritize: (value) => {
        for (const direction of normalizeDirectionList(value)) {
          if (defaultOutputs.includes(direction) && !selection.prioritized.includes(direction)) {
            selection.prioritized.push(direction);
          }
        }
        return buildOutputDirections(defaultOutputs, selection);
      },
      setStatus: (text) => {
        selection.statusText = String(text).slice(0, 120);
      },
      getTick: () => this.getWorldStats().tick,
      getTime: () => this.getWorldStats().time,
    };
  }

  private commitPendingDecision(): void {
    if (!this.pendingDecision) {
      return;
    }

    this.state = this.pendingDecision.nextState;
    if (this.pendingDecision.statusText !== null) {
      this.statusText = this.pendingDecision.statusText;
    }
    this.pendingDecision = null;
  }

  private recordDecision(itemType: ItemId | null, entryDirection: Direction, outputs: Direction[]): void {
    this.lastDecisionItem = itemType;
    this.lastDecisionInputSide = oppositeDirection(entryDirection);
    this.lastDecisionOutputs = [...outputs];
  }
}
