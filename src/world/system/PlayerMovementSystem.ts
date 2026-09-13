import type { PlayerInputState } from '../../input/PlayerInputState';
import type { Player } from '../entity/Player';
import type { MovementResolver } from '../movement/MovementResolver';

export class PlayerMovementSystem {
    constructor(
        private readonly movementResolver: MovementResolver,
    ) { }

    tick(
        player: Player,
        input: Readonly<PlayerInputState>,
        deltaSeconds: number,
    ): void {
        if (
            input.moveX === 0 &&
            input.moveY === 0
        ) {
            return;
        }

        const distance =
            player.movementSpeed *
            deltaSeconds;

        this.movementResolver.moveCircle(
            player,
            input.moveX * distance,
            input.moveY * distance,
        );
    }
}