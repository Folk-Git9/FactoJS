import {
    CHUNK_SIZE_WORLD,
} from './constants';

export class Chunk {
    constructor(
        readonly x: number,
        readonly y: number,
    ) { }

    get left(): number {
        return (
            this.x *
            CHUNK_SIZE_WORLD
        );
    }

    get top(): number {
        return (
            this.y *
            CHUNK_SIZE_WORLD
        );
    }

    get right(): number {
        return (
            this.left +
            CHUNK_SIZE_WORLD
        );
    }

    get bottom(): number {
        return (
            this.top +
            CHUNK_SIZE_WORLD
        );
    }
}