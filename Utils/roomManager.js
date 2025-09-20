// utils/roomManager.js
const rooms = new Map();

function addToRoom(roomId, ws) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
    }
    rooms.get(roomId).add(ws);
    ws.roomId = roomId;
}

function removeFromRoom(ws) {
    if (!ws.roomId || !rooms.has(ws.roomId)) return;
    const room = rooms.get(ws.roomId);
    room.delete(ws);
    if (room.size === 0) {
        rooms.delete(ws.roomId);
    }
}

function broadcastToRoom(roomId, data, sender) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.forEach(peer => {
        if (peer !== sender) {
            peer.send(data);
        }
    });
}

module.exports = {
    addToRoom,
    removeFromRoom,
    broadcastToRoom,
    rooms
};
