import { Container, Graphics } from 'pixi.js';

import type { WorldMap } from '../world/map/WorldMap';

import { CHUNK_SIZE_TILES, TILE_SIZE_WORLD } from '../world/map/constants';

import type { Camera2D } from './Camera2D';
import type { Frustum2D } from './Frustum2D';

const MAJOR_GRID_INTERVAL = 8;

const MINOR_GRID_COLOR = 0x262a31;
const MAJOR_GRID_COLOR = 0x353b45;
const CHUNK_GRID_COLOR = 0x52606f;

const MINOR_GRID_ALPHA = 0.55;
const MAJOR_GRID_ALPHA = 0.8;
const CHUNK_GRID_ALPHA = 1;

export class GridRenderer {
    private readonly minorGrid = new Graphics();
    private readonly majorGrid = new Graphics();
    private readonly chunkGrid = new Graphics();

    constructor(parent: Container) {
        parent.addChild(this.minorGrid, this.majorGrid, this.chunkGrid);
    }

    render(
        camera: Camera2D,
        frustum: Frustum2D,
        map: WorldMap,
        viewportWidth: number,
        viewportHeight: number,
        resolution: number,
    ): void {
        this.minorGrid.clear();
        this.majorGrid.clear();
        this.chunkGrid.clear();

        const bounds = map.bounds;

        const left = bounds === null ? frustum.left : Math.max(frustum.left, bounds.left);

        const top = bounds === null ? frustum.top : Math.max(frustum.top, bounds.top);

        const right = bounds === null ? frustum.right : Math.min(frustum.right, bounds.right);

        const bottom = bounds === null ? frustum.bottom : Math.min(frustum.bottom, bounds.bottom);

        if (right <= left || bottom <= top) {
            return;
        }

        const lod = calculateGridLod(camera.zoom);

        const showMinor = lod === 0;

        const showMajor = lod <= 1;

        const minGridX = Math.floor(left / TILE_SIZE_WORLD) - 1;

        const maxGridX = Math.ceil(right / TILE_SIZE_WORLD) + 1;

        const minGridY = Math.floor(top / TILE_SIZE_WORLD) - 1;

        const maxGridY = Math.ceil(bottom / TILE_SIZE_WORLD) + 1;

        const screenLeft = worldToScreenX(left, camera, viewportWidth);

        const screenRight = worldToScreenX(right, camera, viewportWidth);

        const screenTop = worldToScreenY(top, camera, viewportHeight);

        const screenBottom = worldToScreenY(bottom, camera, viewportHeight);

        for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
            const worldX = gridX * TILE_SIZE_WORLD;

            if (worldX < left || worldX > right) {
                continue;
            }

            const screenX = snapLine(worldToScreenX(worldX, camera, viewportWidth), resolution);

            if (gridX % CHUNK_SIZE_TILES === 0) {
                this.chunkGrid.moveTo(screenX, screenTop).lineTo(screenX, screenBottom);

                continue;
            }

            if (gridX % MAJOR_GRID_INTERVAL === 0) {
                if (showMajor) {
                    this.majorGrid.moveTo(screenX, screenTop).lineTo(screenX, screenBottom);
                }

                continue;
            }

            if (showMinor) {
                this.minorGrid.moveTo(screenX, screenTop).lineTo(screenX, screenBottom);
            }
        }

        for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
            const worldY = gridY * TILE_SIZE_WORLD;

            if (worldY < top || worldY > bottom) {
                continue;
            }

            const screenY = snapLine(worldToScreenY(worldY, camera, viewportHeight), resolution);

            if (gridY % CHUNK_SIZE_TILES === 0) {
                this.chunkGrid.moveTo(screenLeft, screenY).lineTo(screenRight, screenY);

                continue;
            }

            if (gridY % MAJOR_GRID_INTERVAL === 0) {
                if (showMajor) {
                    this.majorGrid.moveTo(screenLeft, screenY).lineTo(screenRight, screenY);
                }

                continue;
            }

            if (showMinor) {
                this.minorGrid.moveTo(screenLeft, screenY).lineTo(screenRight, screenY);
            }
        }

        if (showMinor) {
            this.minorGrid.stroke({
                color: MINOR_GRID_COLOR,

                alpha: MINOR_GRID_ALPHA,

                width: 1,
            });
        }

        if (showMajor) {
            this.majorGrid.stroke({
                color: MAJOR_GRID_COLOR,

                alpha: MAJOR_GRID_ALPHA,

                width: 1,
            });
        }

        this.chunkGrid.stroke({
            color: CHUNK_GRID_COLOR,

            alpha: CHUNK_GRID_ALPHA,

            width: 1,
        });
    }
}

function calculateGridLod(zoom: number): number {
    const tileScreenSize = TILE_SIZE_WORLD * zoom;

    const majorScreenSize = TILE_SIZE_WORLD * MAJOR_GRID_INTERVAL * zoom;

    if (tileScreenSize >= 8) {
        return 0;
    }

    if (majorScreenSize >= 12) {
        return 1;
    }

    return 2;
}

function worldToScreenX(worldX: number, camera: Camera2D, viewportWidth: number): number {
    return (worldX - camera.x) * camera.zoom + viewportWidth * 0.5;
}

function worldToScreenY(worldY: number, camera: Camera2D, viewportHeight: number): number {
    return (worldY - camera.y) * camera.zoom + viewportHeight * 0.5;
}

function snapLine(value: number, resolution: number): number {
    const physical = value * resolution;

    return (Math.floor(physical) + 0.5) / resolution;
}
