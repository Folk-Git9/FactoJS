import { CHUNK_SIZE_TILES } from './constants';

export interface InfiniteWorldMapConfig {
    readonly type: 'infinite';
}

export interface BoundedWorldMapConfig {
    readonly type: 'bounded';

    readonly widthTiles: number;
    readonly heightTiles: number;
}

export type WorldMapConfig = InfiniteWorldMapConfig | BoundedWorldMapConfig;

export function validateWorldMapConfig(config: WorldMapConfig): void {
    if (config.type === 'infinite') {
        return;
    }

    validateMapSize('widthTiles', config.widthTiles);

    validateMapSize('heightTiles', config.heightTiles);
}

function validateMapSize(name: string, value: number): void {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new RangeError(`${name} must be a positive safe integer`);
    }

    if (value % CHUNK_SIZE_TILES !== 0) {
        throw new RangeError(`${name} must be divisible by ${CHUNK_SIZE_TILES}`);
    }
}
