const mariadb = require('mariadb');
const dotenv = require('dotenv');
dotenv.config();

// Create a connection pool
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_db',
  connectionLimit: 10,
  idleTimeout: 60000,
  connectTimeout: 30000,
});

// Test database connection
async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('Database connection established successfully');
    connection.release();
  } catch (error) {
    console.error('Failed to connect to the database:', error);
  }
}

testConnection();

// Export the pool to be used in other files
module.exports = {
  getConnection: async () => {
    try {
      return await pool.getConnection();
    } catch (error) {
      console.error('Database connection error:', error);
      throw error;
    }
  },
  query: async (sql, params) => {
    let connection;
    try {
      connection = await pool.getConnection();
      const result = await connection.query(sql, params);
      return result;
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  },
  executeTransaction: async (callback) => {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();

      const result = await callback(connection);

      await connection.commit();
      return result;
    } catch (error) {
      if (connection) await connection.rollback();
      console.error('Transaction error:', error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }
};