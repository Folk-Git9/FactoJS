export interface MultiplayerPlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
}

export type MultiplayerReplicatedAction =
  | {
    kind: "place_building";
    itemId: string;
    x: number;
    y: number;
    direction: string;
  }
  | {
    kind: "machine_insert";
    x: number;
    y: number;
    itemId: string;
    inputDirection: string;
    count: number;
  }
  | {
    kind: "pickup_building";
    x: number;
    y: number;
  }
  | {
    kind: "mine_resource";
    x: number;
    y: number;
    amount: number;
  };

export type ClientToServerMessage =
  | {
    type: "join";
    roomId: string;
    name: string;
    x: number;
    y: number;
  }
  | {
    type: "move";
    x: number;
    y: number;
  }
  | {
    type: "ping";
    sentAtMs: number;
  }
  | {
    type: "action";
    action: MultiplayerReplicatedAction;
  };

export type ServerToClientMessage =
  | {
    type: "welcome";
    clientId: string;
    roomId: string;
    players: MultiplayerPlayerState[];
  }
  | {
    type: "player_joined";
    player: MultiplayerPlayerState;
  }
  | {
    type: "player_moved";
    id: string;
    x: number;
    y: number;
  }
  | {
    type: "player_left";
    id: string;
  }
  | {
    type: "pong";
    sentAtMs: number;
  }
  | {
    type: "action";
    sourceId: string;
    action: MultiplayerReplicatedAction;
  };
