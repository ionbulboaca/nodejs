const { getAllBenefits } = require('../services/otherService');
const { safeEncrypt } = require('../utils/cryptoUtils');

async function handleRequestID(ws, parsedMessage, peers, serviceFn) {
    try {
        const data = await serviceFn(parsedMessage.data, parsedMessage.type, peers);
        const response = {
            type: parsedMessage.type,
            requestId: parsedMessage.requestId,
            ...(ws.peerId && peers.has(ws.peerId)
                ? { data, status: 'Success' }
                : { error: 'Wrong peerId' })
        };
        ws.send(safeEncrypt(response));
    } catch (err) {
        ws.send(safeEncrypt({
            type: parsedMessage.type,
            requestId: parsedMessage.requestId,
            error: 'Server error while processing market data'
        }));
        console.error(`Error handling items request (${parsedMessage.type}):`, err);
    }
}
module.exports = {
    getAllBenefits: (ws, msg, peers) => handleRequestID(ws, msg, peers, getAllBenefits)
};