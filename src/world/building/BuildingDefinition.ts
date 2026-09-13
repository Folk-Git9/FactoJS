import { BuildingType } from './BuildingType';

export interface BuildingDefinition {
    readonly type: BuildingType;

    readonly widthTiles: number;
    readonly heightTiles: number;
}

const CHEST: BuildingDefinition = {
    type: BuildingType.Chest,

    widthTiles: 1,
    heightTiles: 1,
};

export function getBuildingDefinition(type: BuildingType): BuildingDefinition {
    switch (type) {
        case BuildingType.Chest:
            return CHEST;
    }
}
