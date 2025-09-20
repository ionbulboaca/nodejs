const { safeEncrypt } = require('./cryptoUtils');

/**
 * Broadcast an encrypted message to all peers.
 * @param {Map<string, WebSocket>} peers - Map of peerId to WebSocket connections
 * @param {Object} message - The message to send (will be encrypted)
 */
function broadcastToPeers(peers, message) {
    const encryptedMessage = safeEncrypt(message);

    for (const [peerId, peerSocket] of peers.entries()) {
        if (peerSocket.readyState === peerSocket.OPEN) {
            try {
                peerSocket.send(encryptedMessage);
            } catch (err) {
                console.error(`Failed to send to peer ${peerId}:`, err);
            }
        }
    }
}

module.exports = {
    broadcastToPeers
};