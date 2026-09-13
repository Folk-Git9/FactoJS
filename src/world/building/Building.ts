import type { BuildingType } from './BuildingType';

export interface Building {
    readonly id: number;

    readonly type: BuildingType;

    readonly tileX: number;
    readonly tileY: number;

    readonly widthTiles: number;
    readonly heightTiles: number;
}
