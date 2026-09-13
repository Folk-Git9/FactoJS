import { Container, Graphics } from 'pixi.js';

import type { WorldMap } from '../world/map/WorldMap';

import { CHUNK_SIZE_TILES, TILE_SIZE_WORLD } from '../world/map/constants';

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

    render(frustum: Frustum2D, map: WorldMap): void {
        this.clear();

        if (
            map.getChunkRangeForWorldRect(
                frustum.left,
                frustum.top,
                frustum.right,
                frustum.bottom,
            ) === null
        ) {
            return;
        }

        const bounds = map.bounds;

        const left = bounds === null ? frustum.left : Math.max(frustum.left, bounds.left);

        const top = bounds === null ? frustum.top : Math.max(frustum.top, bounds.top);

        const right = bounds === null ? frustum.right : Math.min(frustum.right, bounds.right);

        const bottom = bounds === null ? frustum.bottom : Math.min(frustum.bottom, bounds.bottom);

        const minGridX = Math.ceil(left / TILE_SIZE_WORLD);

        const maxGridX = Math.floor(right / TILE_SIZE_WORLD);

        const minGridY = Math.ceil(top / TILE_SIZE_WORLD);

        const maxGridY = Math.floor(bottom / TILE_SIZE_WORLD);

        for (let gridX = minGridX; gridX <= maxGridX; gridX++) {
            const x = gridX * TILE_SIZE_WORLD;

            const graphics = this.getGridGraphics(gridX);

            graphics.moveTo(x, top).lineTo(x, bottom);
        }

        for (let gridY = minGridY; gridY <= maxGridY; gridY++) {
            const y = gridY * TILE_SIZE_WORLD;

            const graphics = this.getGridGraphics(gridY);

            graphics.moveTo(left, y).lineTo(right, y);
        }

        this.minorGrid.stroke({
            color: MINOR_GRID_COLOR,

            alpha: MINOR_GRID_ALPHA,

            pixelLine: true,
        });

        this.majorGrid.stroke({
            color: MAJOR_GRID_COLOR,

            alpha: MAJOR_GRID_ALPHA,

            pixelLine: true,
        });

        this.chunkGrid.stroke({
            color: CHUNK_GRID_COLOR,

            alpha: CHUNK_GRID_ALPHA,

            width: 2,
        });
    }

    private clear(): void {
        this.minorGrid.clear();
        this.majorGrid.clear();
        this.chunkGrid.clear();
    }

    private getGridGraphics(gridCoordinate: number): Graphics {
        if (gridCoordinate % CHUNK_SIZE_TILES === 0) {
            return this.chunkGrid;
        }

        if (gridCoordinate % MAJOR_GRID_INTERVAL === 0) {
            return this.majorGrid;
        }

        return this.minorGrid;
    }
}
