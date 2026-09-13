import type { Application, Ticker } from 'pixi.js';

import { InputManager } from '../input/InputManager';
import { WorldRenderer } from '../render/WorldRenderer';
import { World } from '../world/World';
import type { WorldMapConfig } from '../world/map/WorldMapConfig';

const TICKS_PER_SECOND = 60;

const FIXED_DELTA_SECONDS = 1 / TICKS_PER_SECOND;

const MAX_FRAME_DELTA_SECONDS = 0.25;
const MAX_TICKS_PER_FRAME = 8;

export class FactoJS {
    private readonly input: InputManager;

    private readonly world: World;
    private readonly worldRenderer: WorldRenderer;

    private accumulator = 0;

    constructor(
        private readonly app: Application,
        mapConfig: WorldMapConfig,
    ) {
        this.input = new InputManager(this.app.canvas);

        this.world = new World(mapConfig);

        this.worldRenderer = new WorldRenderer(this.app);

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

        this.input.destroy();
        this.worldRenderer.destroy();
    }

    private readonly onFrame = (ticker: Ticker): void => {
        const frameDeltaSeconds = Math.min(ticker.elapsedMS / 1000, MAX_FRAME_DELTA_SECONDS);

        const pointer = this.input.getPointerPosition();

        const pointerWorld = this.worldRenderer.screenToWorld(pointer.x, pointer.y);

        const playerInput = this.input.getPlayerInput(pointerWorld.x, pointerWorld.y);

        this.worldRenderer.addZoomInput(this.input.consumeWheelDelta());

        this.accumulator += frameDeltaSeconds;

        let ticks = 0;

        while (this.accumulator >= FIXED_DELTA_SECONDS && ticks < MAX_TICKS_PER_FRAME) {
            this.world.tick(FIXED_DELTA_SECONDS, playerInput);

            this.accumulator -= FIXED_DELTA_SECONDS;

            ticks++;
        }

        const interpolationAlpha = this.accumulator / FIXED_DELTA_SECONDS;

        this.worldRenderer.updateView(this.world, interpolationAlpha, frameDeltaSeconds);

        this.world.prepareChunksForView(this.worldRenderer.frustum);

        this.worldRenderer.render(this.world, interpolationAlpha);
    };
}
