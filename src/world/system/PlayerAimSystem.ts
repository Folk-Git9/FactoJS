import type { PlayerInputState } from '../../input/PlayerInputState';
import type { Player } from '../entity/Player';

export class PlayerAimSystem {
    tick(player: Player, input: Readonly<PlayerInputState>): void {
        const dx = input.aimX - player.x;

        const dy = input.aimY - player.y;

        if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
            return;
        }

        player.rotation = Math.atan2(dy, dx);
    }
}
