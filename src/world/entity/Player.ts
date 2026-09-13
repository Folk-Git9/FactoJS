export class Player {
    x: number;
    y: number;

    previousX: number;
    previousY: number;

    rotation = 0;
    previousRotation = 0;

    readonly radius = 12;
    readonly movementSpeed = 192;

    constructor(
        x = 0,
        y = 0,
    ) {
        this.x = x;
        this.y = y;

        this.previousX = x;
        this.previousY = y;
    }

    beginTick(): void {
        this.previousX = this.x;
        this.previousY = this.y;

        this.previousRotation =
            this.rotation;
    }
}