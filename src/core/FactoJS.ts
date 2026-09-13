import type { Application, Ticker } from 'pixi.js';
import { World } from '../world/World';

const TICKS_PER_SECOND = 60;
const FIXED_DELTA_SECONDS = 1 / TICKS_PER_SECOND;

const MAX_FRAME_DELTA_SECONDS = 0.25;
const MAX_TICKS_PER_FRAME = 8;

export class FactoJS {
    private readonly app: Application;
    private readonly world: World;

    private accumulator = 0;

    constructor(app: Application) {
        this.app = app;
        this.world = new World();

        this.app.ticker.add(this.onFrame);
    }

    start(): void {
        this.accumulator = 0;

        this.app.start();
    }

    stop(): void {
        this.app.stop();

        this.accumulator = 0;
    }

    destroy(): void {
        this.stop();

        this.app.ticker.remove(this.onFrame);
    }

    private readonly onFrame = (ticker: Ticker): void => {
        const frameDelta = Math.min(ticker.elapsedMS / 1000, MAX_FRAME_DELTA_SECONDS);

        this.accumulator += frameDelta;

        let ticks = 0;

        while (this.accumulator >= FIXED_DELTA_SECONDS && ticks < MAX_TICKS_PER_FRAME) {
            this.world.tick(FIXED_DELTA_SECONDS);

            this.accumulator -= FIXED_DELTA_SECONDS;
            ticks++;
        }
    };
}
