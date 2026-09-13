export interface MovableCircle {
    x: number;
    y: number;

    readonly radius: number;
}

export interface MovementResolver {
    moveCircle(
        body: MovableCircle,
        deltaX: number,
        deltaY: number,
    ): void;
}