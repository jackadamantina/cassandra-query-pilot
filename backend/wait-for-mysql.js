const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'pilot_user',
  password: process.env.DB_PASSWORD || 'pilot_pass',
  database: process.env.DB_NAME || 'cassandra_pilot',
};

const waitForMySQL = async (maxRetries = 30, retryInterval = 2000) => {
  console.log('Aguardando MySQL estar pronto...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const connection = await mysql.createConnection(dbConfig);
      await connection.execute('SELECT 1');
      await connection.end();
      console.log('✅ MySQL está pronto!');
      return true;
    } catch (error) {
      console.log(`⏳ Tentativa ${i + 1}/${maxRetries} - MySQL não está pronto: ${error.message}`);
      if (i === maxRetries - 1) {
        console.error('❌ Timeout aguardando MySQL');
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, retryInterval));
    }
  }
};

if (require.main === module) {
  waitForMySQL().then(() => {
    console.log('Iniciando servidor...');
    require('./server.js');
  });
}

module.exports = waitForMySQL; 