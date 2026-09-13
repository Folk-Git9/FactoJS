import type { DebugSnapshot } from './DebugSnapshot';

const UPDATE_INTERVAL_SECONDS = 0.25;

export class DebugGui {
    private readonly element: HTMLPreElement;

    private elapsed = 0;
    private visible = true;

    constructor(parent: HTMLElement) {
        this.element = document.createElement('pre');

        this.element.className = 'debug-gui';

        parent.appendChild(this.element);

        window.addEventListener('keydown', this.onKeyDown);
    }

    update(snapshot: DebugSnapshot, deltaSeconds: number): void {
        if (!this.visible) {
            return;
        }

        this.elapsed += deltaSeconds;

        if (this.elapsed < UPDATE_INTERVAL_SECONDS) {
            return;
        }

        this.elapsed = 0;

        this.element.textContent = createDebugText(snapshot);
    }

    destroy(): void {
        window.removeEventListener('keydown', this.onKeyDown);

        this.element.remove();
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.code !== 'F3') {
            return;
        }

        event.preventDefault();

        this.visible = !this.visible;

        this.element.hidden = !this.visible;
    };
}

function createDebugText(stats: DebugSnapshot): string {
    return [
        'FactoJS Debug',
        '',
        `FPS:          ${format(stats.fps, 1)}`,
        `UPS:          ${format(stats.ups, 1)}`,
        `Frame:        ${format(stats.frameTimeMs, 2)} ms`,
        `Delta:        ${format(stats.deltaSeconds, 4)} s`,
        `Ticks/frame:  ${stats.ticksThisFrame}`,
        '',
        'Player',
        `Position:     ${format(stats.playerX, 1)}, ${format(stats.playerY, 1)}`,
        `Rotation:     ${format(stats.playerRotation, 3)} rad`,
        '',
        'Camera',
        `Position:     ${format(stats.cameraX, 1)}, ${format(stats.cameraY, 1)}`,
        `Zoom:         ${format(stats.cameraZoom, 2)}x`,
        '',
        'Chunks',
        `Loaded:       ${stats.loadedChunks}`,
        `Visible:      ${stats.visibleChunks}`,
        `Map:          ${stats.mapType}`,
        '',
        'Frustum',
        `Left:         ${format(stats.frustumLeft, 0)}`,
        `Top:          ${format(stats.frustumTop, 0)}`,
        `Right:        ${format(stats.frustumRight, 0)}`,
        `Bottom:       ${format(stats.frustumBottom, 0)}`,
        '',
        'Renderer',
        `Viewport:     ${format(stats.viewportWidth, 0)} x ${format(stats.viewportHeight, 0)}`,
        `Resolution:   ${format(stats.resolution, 2)}x`,
        '',
        'F3 - toggle debug',
    ].join('\n');
}

function format(value: number, digits: number): string {
    return value.toFixed(digits);
}
