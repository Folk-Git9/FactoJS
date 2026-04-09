import type {
  ClientToServerMessage,
  MultiplayerReplicatedAction,
  MultiplayerPlayerState,
  ServerToClientMessage,
} from "./protocol";

export interface MultiplayerClientConfig {
  serverUrl: string;
  roomId: string;
  playerName: string;
}

type ConnectionState = "disconnected" | "connecting" | "connected";
type StateListener = (state: ConnectionState) => void;
type ActionListener = (action: MultiplayerReplicatedAction, sourceId: string) => void;

const POSITION_SEND_INTERVAL_MS = 100;

export class MultiplayerClient {
  private readonly serverUrl: string;
  private readonly roomId: string;
  private readonly playerName: string;
  private readonly remotePlayers = new Map<string, MultiplayerPlayerState>();
  private readonly stateListeners: StateListener[] = [];
  private readonly actionListeners: ActionListener[] = [];

  private socket: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private clientId: string | null = null;
  private hasJoined = false;
  private lastSentX = Number.NaN;
  private lastSentY = Number.NaN;
  private lastSentAtMs = 0;

  constructor(config: MultiplayerClientConfig) {
    this.serverUrl = config.serverUrl;
    this.roomId = config.roomId;
    this.playerName = config.playerName;
  }

  connect(initialX: number, initialY: number): void {
    if (this.socket) {
      return;
    }
    this.setState("connecting");

    const socket = new WebSocket(this.serverUrl);
    this.socket = socket;

    socket.addEventListener("open", () => {
      if (this.socket !== socket) {
        return;
      }
      this.send({
        type: "join",
        roomId: this.roomId,
        name: this.playerName,
        x: initialX,
        y: initialY,
      });
    });

    socket.addEventListener("message", (event) => {
      if (this.socket !== socket || typeof event.data !== "string") {
        return;
      }
      this.handleServerMessage(event.data);
    });

    socket.addEventListener("close", () => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      this.clientId = null;
      this.hasJoined = false;
      this.remotePlayers.clear();
      this.setState("disconnected");
    });

    socket.addEventListener("error", () => {
      if (this.socket !== socket) {
        return;
      }
      socket.close();
    });
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }
    this.socket.close();
    this.socket = null;
    this.clientId = null;
    this.hasJoined = false;
    this.remotePlayers.clear();
    this.setState("disconnected");
  }

  updateLocalPosition(x: number, y: number): void {
    if (!this.hasJoined || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    const now = performance.now();
    const movedEnough = Math.abs(x - this.lastSentX) > 0.001 || Math.abs(y - this.lastSentY) > 0.001;
    if (!movedEnough && now - this.lastSentAtMs < POSITION_SEND_INTERVAL_MS) {
      return;
    }

    this.send({
      type: "move",
      x,
      y,
    });
    this.lastSentX = x;
    this.lastSentY = y;
    this.lastSentAtMs = now;
  }

  getRemotePlayers(): MultiplayerPlayerState[] {
    return [...this.remotePlayers.values()];
  }

  getState(): ConnectionState {
    return this.state;
  }

  onStateChange(listener: StateListener): () => void {
    this.stateListeners.push(listener);
    return () => {
      const index = this.stateListeners.indexOf(listener);
      if (index >= 0) {
        this.stateListeners.splice(index, 1);
      }
    };
  }

  onAction(listener: ActionListener): () => void {
    this.actionListeners.push(listener);
    return () => {
      const index = this.actionListeners.indexOf(listener);
      if (index >= 0) {
        this.actionListeners.splice(index, 1);
      }
    };
  }

  sendAction(action: MultiplayerReplicatedAction): void {
    if (!this.hasJoined || !this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.send({
      type: "action",
      action,
    });
  }

  private handleServerMessage(rawData: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawData);
    } catch {
      return;
    }

    const message = parsed as Partial<ServerToClientMessage>;
    if (!message || typeof message !== "object" || typeof message.type !== "string") {
      return;
    }

    switch (message.type) {
      case "welcome": {
        if (!message.clientId || !Array.isArray(message.players)) {
          return;
        }
        this.clientId = message.clientId;
        this.remotePlayers.clear();
        for (const player of message.players) {
          if (!player || typeof player.id !== "string") {
            continue;
          }
          if (player.id === this.clientId) {
            continue;
          }
          this.remotePlayers.set(player.id, player);
        }
        this.hasJoined = true;
        this.setState("connected");
        return;
      }
      case "player_joined": {
        const player = message.player;
        if (!player || typeof player.id !== "string") {
          return;
        }
        if (player.id === this.clientId) {
          return;
        }
        this.remotePlayers.set(player.id, player);
        return;
      }
      case "player_moved": {
        if (typeof message.id !== "string" || typeof message.x !== "number" || typeof message.y !== "number") {
          return;
        }
        if (message.id === this.clientId) {
          return;
        }
        const existing = this.remotePlayers.get(message.id);
        if (existing) {
          existing.x = message.x;
          existing.y = message.y;
          this.remotePlayers.set(message.id, existing);
        } else {
          this.remotePlayers.set(message.id, {
            id: message.id,
            name: "Player",
            x: message.x,
            y: message.y,
          });
        }
        return;
      }
      case "player_left": {
        if (typeof message.id !== "string") {
          return;
        }
        this.remotePlayers.delete(message.id);
        return;
      }
      case "pong":
        return;
      case "action": {
        if (!message.sourceId || !message.action) {
          return;
        }
        if (message.sourceId === this.clientId) {
          return;
        }
        for (const listener of this.actionListeners) {
          listener(message.action, message.sourceId);
        }
        return;
      }
      default:
        return;
    }
  }

  private send(message: ClientToServerMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    this.socket.send(JSON.stringify(message));
  }

  private setState(nextState: ConnectionState): void {
    if (this.state === nextState) {
      return;
    }
    this.state = nextState;
    for (const listener of this.stateListeners) {
      listener(nextState);
    }
  }
}
