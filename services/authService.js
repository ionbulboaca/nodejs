const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

// Database connection configuration

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    dateStrings: true
};


// Authenticate user and generate token
async function authenticateUser(username, password) {
    // Example of a parameterized query
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
  		'SELECT * FROM user WHERE username = ?',
  		[username] // Always use parameterized inputs
    );
    if (rows.length === 0) {
      	throw new Error('Invalid username or password')
    }
    const user = rows[0];

    // Compare the hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      	throw new Error('Invalid username or password')
    }

    // Generate JWT token
    const token = jwt.sign(
        { 'id':user.id, 'name': user.name,'username':user.username, 'status':user.status,'created_at':user.created_at },
        process.env.JWT_SECRET,
        { expiresIn: '1h' } // Token expiration time
    );

    return { token, user };
}

module.exports = {
    authenticateUser,
};