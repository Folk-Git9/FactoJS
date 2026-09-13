import type { ChunkRange } from './ChunkRange';

import { ChunkManager } from './ChunkManager';

import type { WorldMapConfig } from './WorldMapConfig';

import type { WorldMapBounds } from './WorldMapBounds';

import { WorldGenerator } from './WorldGenerator';

import { CHUNK_SIZE_TILES, CHUNK_SIZE_WORLD } from './constants';

import { validateWorldMapConfig } from './WorldMapConfig';

const DEFAULT_WORLD_SEED = 0x4f31a9c7;

const LOAD_PADDING_CHUNKS = 1;
const UNLOAD_PADDING_CHUNKS = 2;

export class WorldMap {
    readonly config: WorldMapConfig;
    readonly bounds: WorldMapBounds | null;

    private readonly chunks: ChunkManager;

    constructor(config: WorldMapConfig) {
        validateWorldMapConfig(config);

        this.config = cloneConfig(config);

        this.bounds = createBounds(config);

        this.chunks = new ChunkManager(new WorldGenerator(DEFAULT_WORLD_SEED));
    }

    getChunk(chunkX: number, chunkY: number) {
        assertChunkCoordinate(chunkX, chunkY);

        if (!this.isChunkInBounds(chunkX, chunkY)) {
            return undefined;
        }

        return this.chunks.get(chunkX, chunkY);
    }

    prepareChunkRange(visibleRange: ChunkRange): void {
        const loadRange = this.clampChunkRange(expandChunkRange(visibleRange, LOAD_PADDING_CHUNKS));

        if (loadRange === null) {
            return;
        }

        for (let chunkY = loadRange.minY; chunkY <= loadRange.maxY; chunkY++) {
            for (let chunkX = loadRange.minX; chunkX <= loadRange.maxX; chunkX++) {
                this.chunks.getOrCreate(chunkX, chunkY);
            }
        }

        const unloadRange = this.clampChunkRange(
            expandChunkRange(visibleRange, UNLOAD_PADDING_CHUNKS),
        );

        if (unloadRange !== null) {
            this.chunks.unloadOutside(unloadRange);
        }
    }

    worldToChunkX(worldX: number): number {
        return Math.floor(worldX / CHUNK_SIZE_WORLD);
    }

    worldToChunkY(worldY: number): number {
        return Math.floor(worldY / CHUNK_SIZE_WORLD);
    }

    isChunkInBounds(chunkX: number, chunkY: number): boolean {
        const bounds = this.bounds;

        if (bounds === null) {
            return true;
        }

        return (
            chunkX >= bounds.minChunkX &&
            chunkX < bounds.maxChunkXExclusive &&
            chunkY >= bounds.minChunkY &&
            chunkY < bounds.maxChunkYExclusive
        );
    }

    containsWorldPoint(x: number, y: number): boolean {
        const bounds = this.bounds;

        if (bounds === null) {
            return true;
        }

        return x >= bounds.left && x < bounds.right && y >= bounds.top && y < bounds.bottom;
    }

    getChunkRangeForWorldRect(
        left: number,
        top: number,
        right: number,
        bottom: number,
    ): ChunkRange | null {
        if (this.bounds !== null) {
            left = Math.max(left, this.bounds.left);

            top = Math.max(top, this.bounds.top);

            right = Math.min(right, this.bounds.right);

            bottom = Math.min(bottom, this.bounds.bottom);
        }

        if (right <= left || bottom <= top) {
            return null;
        }

        return {
            minX: Math.floor(left / CHUNK_SIZE_WORLD),

            minY: Math.floor(top / CHUNK_SIZE_WORLD),

            maxX: Math.ceil(right / CHUNK_SIZE_WORLD) - 1,

            maxY: Math.ceil(bottom / CHUNK_SIZE_WORLD) - 1,
        };
    }

    getSpawnPosition(): {
        x: number;
        y: number;
    } {
        if (this.bounds === null) {
            return {
                x: 0,
                y: 0,
            };
        }

        return {
            x: (this.bounds.left + this.bounds.right) * 0.5,

            y: (this.bounds.top + this.bounds.bottom) * 0.5,
        };
    }

    private clampChunkRange(range: ChunkRange): ChunkRange | null {
        if (this.bounds === null) {
            return range;
        }

        const minX = Math.max(range.minX, this.bounds.minChunkX);

        const minY = Math.max(range.minY, this.bounds.minChunkY);

        const maxX = Math.min(range.maxX, this.bounds.maxChunkXExclusive - 1);

        const maxY = Math.min(range.maxY, this.bounds.maxChunkYExclusive - 1);

        if (minX > maxX || minY > maxY) {
            return null;
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
        };
    }
}

function expandChunkRange(range: ChunkRange, amount: number): ChunkRange {
    return {
        minX: range.minX - amount,

        minY: range.minY - amount,

        maxX: range.maxX + amount,

        maxY: range.maxY + amount,
    };
}

function createBounds(config: WorldMapConfig): WorldMapBounds | null {
    if (config.type === 'infinite') {
        return null;
    }

    const widthChunks = config.widthTiles / CHUNK_SIZE_TILES;

    const heightChunks = config.heightTiles / CHUNK_SIZE_TILES;

    const minChunkX = -Math.floor(widthChunks / 2);

    const minChunkY = -Math.floor(heightChunks / 2);

    const maxChunkXExclusive = minChunkX + widthChunks;

    const maxChunkYExclusive = minChunkY + heightChunks;

    return {
        minChunkX,
        minChunkY,

        maxChunkXExclusive,
        maxChunkYExclusive,

        left: minChunkX * CHUNK_SIZE_WORLD,

        top: minChunkY * CHUNK_SIZE_WORLD,

        right: maxChunkXExclusive * CHUNK_SIZE_WORLD,

        bottom: maxChunkYExclusive * CHUNK_SIZE_WORLD,
    };
}

function cloneConfig(config: WorldMapConfig): WorldMapConfig {
    if (config.type === 'infinite') {
        return {
            type: 'infinite',
        };
    }

    return {
        type: 'bounded',

        widthTiles: config.widthTiles,

        heightTiles: config.heightTiles,
    };
}

function assertChunkCoordinate(x: number, y: number): void {
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
        throw new RangeError('Chunk coordinates must be safe integers');
    }
}
