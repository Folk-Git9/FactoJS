import { CHUNK_SIZE_TILES, CHUNK_SIZE_WORLD, CHUNK_TILE_COUNT } from './constants';

import type { TerrainType } from './TerrainType';

export class Chunk {
    readonly terrain = new Uint8Array(CHUNK_TILE_COUNT);

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

    getTerrain(localX: number, localY: number): TerrainType {
        return this.terrain[tileIndex(localX, localY)]!;
    }

    setTerrain(localX: number, localY: number, terrain: TerrainType): void {
        this.terrain[tileIndex(localX, localY)] = terrain;
    }
}

function tileIndex(x: number, y: number): number {
    if (x < 0 || x >= CHUNK_SIZE_TILES || y < 0 || y >= CHUNK_SIZE_TILES) {
        throw new RangeError(`Tile (${x}, ${y}) is outside the chunk`);
    }

    return y * CHUNK_SIZE_TILES + x;
}
