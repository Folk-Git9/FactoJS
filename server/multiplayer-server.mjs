import { WebSocketServer } from "ws";

const PORT = Number(process.env.MP_PORT ?? 2567);

/** @type {Map<string, Map<string, { id: string, name: string, x: number, y: number, socket: import("ws").WebSocket }>>} */
const rooms = new Map();
let nextClientId = 1;

const getOrCreateRoom = (roomId) => {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Map();
    rooms.set(roomId, room);
  }
  return room;
};

const broadcast = (room, payload, exceptId = null) => {
  const serialized = JSON.stringify(payload);
  for (const [id, client] of room.entries()) {
    if (exceptId && id === exceptId) {
      continue;
    }
    if (client.socket.readyState === client.socket.OPEN) {
      client.socket.send(serialized);
    }
  }
};

const toPlayerState = (entry) => ({
  id: entry.id,
  name: entry.name,
  x: entry.x,
  y: entry.y,
});

const server = new WebSocketServer({ port: PORT });

server.on("connection", (socket) => {
  const clientId = `p${nextClientId++}`;
  let joinedRoomId = null;

  socket.on("message", (rawMessage) => {
    if (typeof rawMessage !== "string" && !Buffer.isBuffer(rawMessage)) {
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(rawMessage.toString());
    } catch {
      return;
    }

    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      return;
    }

    if (parsed.type === "join") {
      if (joinedRoomId) {
        return;
      }
      if (typeof parsed.roomId !== "string" || typeof parsed.name !== "string") {
        return;
      }

      const roomId = parsed.roomId.trim() || "default";
      const room = getOrCreateRoom(roomId);

      const entry = {
        id: clientId,
        name: parsed.name.slice(0, 24) || "Player",
        x: typeof parsed.x === "number" ? parsed.x : 0,
        y: typeof parsed.y === "number" ? parsed.y : 0,
        socket,
      };
      room.set(clientId, entry);
      joinedRoomId = roomId;

      socket.send(
        JSON.stringify({
          type: "welcome",
          clientId,
          roomId,
          players: [...room.values()].map(toPlayerState),
        })
      );

      broadcast(
        room,
        {
          type: "player_joined",
          player: toPlayerState(entry),
        },
        clientId
      );
      return;
    }

    if (!joinedRoomId) {
      return;
    }

    const room = rooms.get(joinedRoomId);
    const entry = room?.get(clientId);
    if (!room || !entry) {
      return;
    }

    if (parsed.type === "move") {
      if (typeof parsed.x !== "number" || typeof parsed.y !== "number") {
        return;
      }
      entry.x = parsed.x;
      entry.y = parsed.y;

      broadcast(
        room,
        {
          type: "player_moved",
          id: clientId,
          x: entry.x,
          y: entry.y,
        },
        clientId
      );
      return;
    }

    if (parsed.type === "action") {
      if (!parsed.action || typeof parsed.action !== "object" || typeof parsed.action.kind !== "string") {
        return;
      }

      broadcast(
        room,
        {
          type: "action",
          sourceId: clientId,
          action: parsed.action,
        },
        clientId
      );
      return;
    }

    if (parsed.type === "ping") {
      socket.send(
        JSON.stringify({
          type: "pong",
          sentAtMs: typeof parsed.sentAtMs === "number" ? parsed.sentAtMs : 0,
        })
      );
    }
  });

  socket.on("close", () => {
    if (!joinedRoomId) {
      return;
    }
    const room = rooms.get(joinedRoomId);
    if (!room) {
      return;
    }
    const existed = room.delete(clientId);
    if (!existed) {
      return;
    }

    broadcast(room, {
      type: "player_left",
      id: clientId,
    });

    if (room.size === 0) {
      rooms.delete(joinedRoomId);
    }
  });
});

console.log(`Multiplayer server listening on ws://localhost:${PORT}`);
