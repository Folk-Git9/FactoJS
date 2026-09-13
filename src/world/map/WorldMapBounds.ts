export interface WorldMapBounds {
    readonly left: number;
    readonly top: number;

    readonly right: number;
    readonly bottom: number;

    readonly minChunkX: number;
    readonly minChunkY: number;

    readonly maxChunkXExclusive: number;
    readonly maxChunkYExclusive: number;
}