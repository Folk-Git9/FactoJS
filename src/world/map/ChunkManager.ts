import { Chunk } from './Chunk';
import type { ChunkRange } from './ChunkRange';
import { WorldGenerator } from './WorldGenerator';

export class ChunkManager {
    private readonly chunks = new Map<number, Map<number, Chunk>>();

    constructor(private readonly generator: WorldGenerator) {}

    get size(): number {
        let size = 0;

        for (const column of this.chunks.values()) {
            size += column.size;
        }

        return size;
    }

    get(chunkX: number, chunkY: number): Chunk | undefined {
        return this.chunks.get(chunkX)?.get(chunkY);
    }

    has(chunkX: number, chunkY: number): boolean {
        return this.get(chunkX, chunkY) !== undefined;
    }

    getOrCreate(chunkX: number, chunkY: number): Chunk {
        let column = this.chunks.get(chunkX);

        if (column === undefined) {
            column = new Map<number, Chunk>();

            this.chunks.set(chunkX, column);
        }

        let chunk = column.get(chunkY);

        if (chunk !== undefined) {
            return chunk;
        }

        chunk = new Chunk(chunkX, chunkY);

        this.generator.generateChunk(chunk);

        column.set(chunkY, chunk);

        return chunk;
    }

    unloadOutside(range: ChunkRange): void {
        for (const [chunkX, column] of this.chunks) {
            for (const [chunkY, chunk] of column) {
                const outside =
                    chunkX < range.minX ||
                    chunkX > range.maxX ||
                    chunkY < range.minY ||
                    chunkY > range.maxY;

                if (outside && !chunk.hasOccupancy) {
                    column.delete(chunkY);
                }
            }

            if (column.size === 0) {
                this.chunks.delete(chunkX);
            }
        }
    }
}
