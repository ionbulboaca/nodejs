const mysql = require('mysql2/promise');

// Database connection configuration

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true
};
const pool = mysql.createPool(dbConfig);

async function fetchData(query, params = []) {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(query, params);
        return rows;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    } finally {
        connection.release();
    }
}

async function getAllBenefits(msg) {
    let query = `
        SELECT 
           *
        FROM benefits WHERE 1=1
    `; // the table have only 20 rows that's why i use 1=1 and then the conditional if any
    const params = [];

    if (msg?.id != null  && msg.id != 0) {
        query += ` AND id = ?`;
        params.push(msg.id);
    }
    return fetchData(query, params);
}
module.exports = {
    getAllBenefits
};