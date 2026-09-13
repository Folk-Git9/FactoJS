import type { Application, Ticker } from 'pixi.js';

import { GuiManager } from '../gui/GuiManager';
import { DebugStats } from '../gui/debug/DebugStats';

import type { DebugSnapshot } from '../gui/debug/DebugSnapshot';

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

    private readonly gui: GuiManager;

    private readonly debugStats = new DebugStats();

    private accumulator = 0;

    constructor(
        private readonly app: Application,
        guiParent: HTMLElement,
        mapConfig: WorldMapConfig,
    ) {
        this.input = new InputManager(this.app.canvas);

        this.world = new World(mapConfig);

        this.worldRenderer = new WorldRenderer(this.app);

        this.gui = new GuiManager(guiParent);

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

        this.gui.destroy();

        this.worldRenderer.destroy();
    }

    private readonly onFrame = (ticker: Ticker): void => {
        const frameDeltaSeconds = Math.min(ticker.elapsedMS / 1000, MAX_FRAME_DELTA_SECONDS);

        const pointer = this.input.getPointerPosition();

        const pointerWorld = this.worldRenderer.screenToWorld(pointer.x, pointer.y);

        this.worldRenderer.addZoomInput(this.input.consumeWheelDelta());

        this.accumulator += frameDeltaSeconds;

        let ticksThisFrame = 0;

        while (this.accumulator >= FIXED_DELTA_SECONDS && ticksThisFrame < MAX_TICKS_PER_FRAME) {
            const playerInput = this.input.getPlayerInput(
                pointerWorld.x,
                pointerWorld.y,
                this.input.consumePlacePressed(),
            );

            this.world.tick(FIXED_DELTA_SECONDS, playerInput);

            this.accumulator -= FIXED_DELTA_SECONDS;

            ticksThisFrame++;
        }

        const interpolationAlpha = this.accumulator / FIXED_DELTA_SECONDS;

        this.worldRenderer.updateView(this.world, interpolationAlpha, frameDeltaSeconds);

        this.world.prepareChunksForView(this.worldRenderer.frustum);

        this.worldRenderer.render(this.world, interpolationAlpha);

        this.debugStats.frame(frameDeltaSeconds, ticksThisFrame);

        this.gui.updateDebug(this.createDebugSnapshot(ticksThisFrame), frameDeltaSeconds);
    };

    private createDebugSnapshot(ticksThisFrame: number): DebugSnapshot {
        const player = this.world.player;

        const camera = this.worldRenderer.camera;

        const frustum = this.worldRenderer.frustum;

        const screen = this.app.renderer.screen;

        const visibleRange = this.world.map.getChunkRangeForWorldRect(
            frustum.left,
            frustum.top,
            frustum.right,
            frustum.bottom,
        );

        const visibleChunks =
            visibleRange === null
                ? 0
                : (visibleRange.maxX - visibleRange.minX + 1) *
                  (visibleRange.maxY - visibleRange.minY + 1);

        return {
            fps: this.debugStats.fps,

            ups: this.debugStats.ups,

            deltaSeconds: this.debugStats.deltaSeconds,

            frameTimeMs: this.debugStats.frameTimeMs,

            ticksThisFrame,

            playerX: player.x,

            playerY: player.y,

            playerRotation: player.rotation,

            cameraX: camera.x,

            cameraY: camera.y,

            cameraZoom: camera.zoom,

            frustumLeft: frustum.left,

            frustumTop: frustum.top,

            frustumRight: frustum.right,

            frustumBottom: frustum.bottom,

            loadedChunks: this.world.map.loadedChunkCount,

            visibleChunks,

            mapType: this.world.map.config.type,

            viewportWidth: screen.width,

            viewportHeight: screen.height,

            resolution: this.app.renderer.resolution,
        };
    }
}
