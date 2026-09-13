import type { TerrainType } from './TerrainType';

import { CHUNK_SIZE_TILES, CHUNK_SIZE_WORLD, CHUNK_TILE_COUNT } from './constants';

export class Chunk {
    readonly terrain = new Uint8Array(CHUNK_TILE_COUNT);

    readonly occupancy = new Uint32Array(CHUNK_TILE_COUNT);

    private occupiedTiles = 0;

    constructor(
        readonly x: number,
        readonly y: number,
    ) {}

    get left(): number {
        return this.x * CHUNK_SIZE_WORLD;
    }

    get top(): number {
        return this.y * CHUNK_SIZE_WORLD;
    }

    get right(): number {
        return this.left + CHUNK_SIZE_WORLD;
    }

    get bottom(): number {
        return this.top + CHUNK_SIZE_WORLD;
    }

    get hasOccupancy(): boolean {
        return this.occupiedTiles > 0;
    }

    getTerrain(localX: number, localY: number): TerrainType {
        return this.terrain[tileIndex(localX, localY)]!;
    }

    setTerrain(localX: number, localY: number, terrain: TerrainType): void {
        this.terrain[tileIndex(localX, localY)] = terrain;
    }

    getOccupancy(localX: number, localY: number): number {
        return this.occupancy[tileIndex(localX, localY)]!;
    }

    setOccupancy(localX: number, localY: number, buildingId: number): void {
        const index = tileIndex(localX, localY);

        const previous = this.occupancy[index]!;

        if (previous === 0 && buildingId !== 0) {
            this.occupiedTiles++;
        } else if (previous !== 0 && buildingId === 0) {
            this.occupiedTiles--;
        }

        this.occupancy[index] = buildingId;
    }

    forEachOccupied(callback: (localX: number, localY: number, buildingId: number) => void): void {
        for (let localY = 0; localY < CHUNK_SIZE_TILES; localY++) {
            for (let localX = 0; localX < CHUNK_SIZE_TILES; localX++) {
                const id = this.occupancy[localY * CHUNK_SIZE_TILES + localX]!;

                if (id !== 0) {
                    callback(localX, localY, id);
                }
            }
        }
    }
}

function tileIndex(x: number, y: number): number {
    if (x < 0 || x >= CHUNK_SIZE_TILES || y < 0 || y >= CHUNK_SIZE_TILES) {
        throw new RangeError(`Tile (${x}, ${y}) is outside the chunk`);
    }

    return y * CHUNK_SIZE_TILES + x;
}
