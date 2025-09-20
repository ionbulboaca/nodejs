// utils/cryptoUtils.js
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const key = Buffer.from( '0123456789abcdef0123456789abcdef'); // dummy key
const iv = Buffer.from( 'abcdef1234567890'); // dummy iv

function safeEncrypt(data) {
    try {
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
        let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    } catch (e) {
        console.error('Encryption error:', e);
        return null;
    }
}

function safeDecrypt(encrypted) {
    try {
        const encryptedText = Buffer.isBuffer(encrypted)
            ? encrypted.toString('utf8')
            : encrypted;

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        console.error('Decryption failed:', error.message);
        throw error;
    }
}

async function verifyToken(token) {
    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
            if (err) return reject(err);
            resolve(user);
        });
    });
}

module.exports = {
    safeEncrypt,
    safeDecrypt,
    verifyToken
};
