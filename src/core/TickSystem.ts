export class TickSystem {
  private readonly fixedDeltaSeconds: number;
  private accumulatorSeconds = 0;
  private readonly tickRate: number;
  private readonly maxStepsPerFrame: number;

  constructor(tickRate = 60, maxStepsPerFrame = 5) {
    this.tickRate = tickRate;
    this.maxStepsPerFrame = maxStepsPerFrame;
    this.fixedDeltaSeconds = 1 / tickRate;
  }

  update(deltaSeconds: number, step: (fixedDelta: number) => void): void {
    this.accumulatorSeconds += Math.max(0, deltaSeconds);

    let steps = 0;
    while (this.accumulatorSeconds >= this.fixedDeltaSeconds && steps < this.maxStepsPerFrame) {
      step(this.fixedDeltaSeconds);
      this.accumulatorSeconds -= this.fixedDeltaSeconds;
      steps += 1;
    }
  }

  getTickRate(): number {
    return this.tickRate;
  }
}
