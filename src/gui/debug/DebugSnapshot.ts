export interface DebugSnapshot {
    readonly fps: number;
    readonly ups: number;

    readonly deltaSeconds: number;
    readonly frameTimeMs: number;

    readonly ticksThisFrame: number;

    readonly playerX: number;
    readonly playerY: number;
    readonly playerRotation: number;

    readonly cameraX: number;
    readonly cameraY: number;
    readonly cameraZoom: number;

    readonly frustumLeft: number;
    readonly frustumTop: number;
    readonly frustumRight: number;
    readonly frustumBottom: number;

    readonly loadedChunks: number;
    readonly visibleChunks: number;

    readonly mapType: 'infinite' | 'bounded';

    readonly viewportWidth: number;
    readonly viewportHeight: number;
    readonly resolution: number;
}
