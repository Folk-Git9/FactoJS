import type { BuildingType } from './BuildingType';

export interface PlacementPreview {
    type: BuildingType;

    tileX: number;
    tileY: number;

    valid: boolean;
}
