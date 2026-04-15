export class ShotTracer {
  readonly id: string;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly durationSeconds: number;
  remainingSeconds: number;

  constructor(
    id: string,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    durationSeconds = 0.09
  ) {
    this.id = id;
    this.fromX = fromX;
    this.fromY = fromY;
    this.toX = toX;
    this.toY = toY;
    this.durationSeconds = Math.max(0.02, durationSeconds);
    this.remainingSeconds = this.durationSeconds;
  }

  advance(deltaSeconds: number): void {
    this.remainingSeconds = Math.max(0, this.remainingSeconds - deltaSeconds);
  }

  get opacity01(): number {
    if (this.durationSeconds <= 0) {
      return 0;
    }
    return Math.min(Math.max(this.remainingSeconds / this.durationSeconds, 0), 1);
  }
}
