import { Chunk } from './Chunk';
import { TerrainType } from './TerrainType';

import { CHUNK_SIZE_TILES } from './constants';

const TERRAIN_SCALE = 18;

export class WorldGenerator {
    constructor(private readonly seed: number) {}

    generateChunk(chunk: Chunk): void {
        const worldTileStartX = chunk.x * CHUNK_SIZE_TILES;

        const worldTileStartY = chunk.y * CHUNK_SIZE_TILES;

        for (let localY = 0; localY < CHUNK_SIZE_TILES; localY++) {
            for (let localX = 0; localX < CHUNK_SIZE_TILES; localX++) {
                const tileX = worldTileStartX + localX;

                const tileY = worldTileStartY + localY;

                const value = valueNoise(tileX / TERRAIN_SCALE, tileY / TERRAIN_SCALE, this.seed);

                chunk.setTerrain(localX, localY, selectTerrain(value));
            }
        }
    }
}

function selectTerrain(value: number): TerrainType {
    if (value < 0.24) {
        return TerrainType.Water;
    }

    if (value < 0.32) {
        return TerrainType.Sand;
    }

    if (value < 0.47) {
        return TerrainType.Dirt;
    }

    return TerrainType.Grass;
}

function valueNoise(x: number, y: number, seed: number): number {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);

    const x1 = x0 + 1;
    const y1 = y0 + 1;

    const tx = smoothstep(x - x0);

    const ty = smoothstep(y - y0);

    const top = lerp(random2D(x0, y0, seed), random2D(x1, y0, seed), tx);

    const bottom = lerp(random2D(x0, y1, seed), random2D(x1, y1, seed), tx);

    return lerp(top, bottom, ty);
}

function random2D(x: number, y: number, seed: number): number {
    let hash = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495) ^ seed;

    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);

    hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);

    hash ^= hash >>> 16;

    return (hash >>> 0) / 0xffffffff;
}

function smoothstep(value: number): number {
    return value * value * (3 - 2 * value);
}

function lerp(from: number, to: number, alpha: number): number {
    return from + (to - from) * alpha;
}
