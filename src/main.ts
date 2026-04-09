import { Game } from "./core/Game";
import { MultiplayerClient } from "./net/MultiplayerClient";

const params = new URLSearchParams(window.location.search);
const multiplayerEnabled = params.get("mp") === "1";

const multiplayerClient = multiplayerEnabled
  ? new MultiplayerClient({
    serverUrl: params.get("ws") ?? "ws://localhost:2567",
    roomId: params.get("room") ?? "default",
    playerName: params.get("name") ?? `Player-${Math.floor(Math.random() * 10000)}`,
  })
  : null;

const game = new Game(document.body, {
  multiplayerClient,
});
game.start();
