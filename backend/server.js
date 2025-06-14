const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cassandra = require('cassandra-driver');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares de segurança
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // máximo 100 requests por IP por janela
});
app.use('/api/', limiter);

// Configuração do banco MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'mysql',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'pilot_user',
  password: process.env.DB_PASSWORD || 'pilot_pass',
  database: process.env.DB_NAME || 'cassandra_pilot',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acesso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'cassandra-pilot-secret-key-2024', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    next();
  });
};

// Função para log de auditoria
const logAudit = async (userId, action, resourceType, resourceId, details, req) => {
  try {
    const connection = await pool.getConnection();
    await connection.execute(
      'INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, action, resourceType, resourceId, JSON.stringify(details), req.ip, req.get('User-Agent')]
    );
    connection.release();
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error);
  }
};

// Rotas de autenticação
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username e password são obrigatórios' });
    }

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT * FROM users WHERE username = ? AND is_active = TRUE',
      [username]
    );
    connection.release();

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Atualizar último login
    const connection2 = await pool.getConnection();
    await connection2.execute(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );
    connection2.release();

    // Gerar token JWT
    const token = jwt.sign(
      { 
        id: user.id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'cassandra-pilot-secret-key-2024',
      { expiresIn: '24h' }
    );

    // Log de auditoria
    await logAudit(user.id, 'LOGIN', 'USER', user.id, { success: true }, req);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para listar clusters
app.get('/api/clusters', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT id, name, host, port, hosts, datacenter FROM cassandra_clusters WHERE is_active = TRUE ORDER BY name'
    );
    connection.release();

    // Processar os hosts JSON para cada cluster
    const clustersWithHosts = rows.map(row => {
      let hosts;
      try {
        if (row.hosts && typeof row.hosts === 'string') {
          hosts = JSON.parse(row.hosts);
        } else if (row.hosts && Array.isArray(row.hosts)) {
          hosts = row.hosts;
        } else {
          hosts = [`${row.host}:${row.port}`];
        }
      } catch (error) {
        console.error(`Erro ao parsear JSON hosts para cluster ${row.name}:`, error);
        hosts = [`${row.host}:${row.port}`];
      }
      return {
        ...row,
        hosts
      };
    });

    res.json(clustersWithHosts);
  } catch (error) {
    console.error('Erro ao listar clusters:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para executar queries no Cassandra
app.post('/api/query/execute', authenticateToken, async (req, res) => {
  try {
    const { clusterId, query } = req.body;

    if (!clusterId || !query) {
      return res.status(400).json({ error: 'Cluster ID e query são obrigatórios' });
    }

    // Buscar informações do cluster
    const connection = await pool.getConnection();
    const [clusterRows] = await connection.execute(
      'SELECT * FROM cassandra_clusters WHERE id = ? AND is_active = TRUE',
      [clusterId]
    );
    connection.release();

    if (clusterRows.length === 0) {
      return res.status(404).json({ error: 'Cluster não encontrado' });
    }

    const cluster = clusterRows[0];
    const startTime = Date.now();

    try {
      // Validar se o comando é apenas SELECT
      const trimmedQuery = query.trim().toLowerCase();
      const forbiddenCommands = ['insert', 'update', 'delete', 'drop', 'create', 'alter', 'truncate', 'grant', 'revoke'];
      
      const commandUsed = forbiddenCommands.find(cmd => trimmedQuery.startsWith(cmd));
      if (commandUsed) {
        throw new Error(`Comando '${commandUsed.toUpperCase()}' não é permitido. Apenas comandos SELECT são aceitos.`);
      }

      if (!trimmedQuery.startsWith('select')) {
        throw new Error('Apenas comandos SELECT são permitidos.');
      }

      // Preparar hosts para conexão
      let hosts;
      try {
        if (cluster.hosts && typeof cluster.hosts === 'string') {
          hosts = JSON.parse(cluster.hosts);
        } else if (cluster.hosts && Array.isArray(cluster.hosts)) {
          hosts = cluster.hosts;
        } else {
          hosts = [`${cluster.host}:${cluster.port}`];
        }
      } catch (error) {
        console.error(`Erro ao parsear hosts para execução de query:`, error);
        hosts = [`${cluster.host}:${cluster.port}`];
      }

      // Extrair IPs e portas dos hosts
      const contactPoints = hosts.map(host => {
        const [ip, port] = host.split(':');
        return ip;
      });
      
      console.log(`Executando query no cluster ${cluster.name} com contact points: ${contactPoints.join(', ')}`);

      // Conectar ao Cassandra real
      console.log(`Tentando conectar no Cassandra com config:`, {
        contactPoints,
        localDataCenter: cluster.datacenter || 'datacenter1',
        hasCredentials: !!(cluster.username && cluster.password)
      });

      const cassandraClient = new cassandra.Client({
        contactPoints: contactPoints,
        localDataCenter: cluster.datacenter || 'datacenter1',
        credentials: cluster.username && cluster.password ? {
          username: cluster.username,
          password: cluster.password
        } : undefined,
        socketOptions: {
          connectTimeout: 10000,
          readTimeout: 30000
        }
      });

      try {
        console.log(`Executando query Cassandra: ${query}`);
        // Executar a query real
        const result = await cassandraClient.execute(query);
        console.log(`Query executada com sucesso. Colunas: ${result.columns?.length || 0}, Linhas: ${result.rows?.length || 0}`);
        
        // Processar resultado
        const columns = result.columns ? result.columns.map(col => col.name) : [];
        const rows = result.rows ? result.rows.map(row => {
          return columns.map(col => {
            const value = row[col];
            if (value === null || value === undefined) return '';
            if (value instanceof Date) return value.toISOString();
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
          });
        }) : [];

                 const executionTime = Date.now() - startTime;
         
         // Fechar conexão
         await cassandraClient.shutdown();

         const queryResult = {
           columns,
           rows,
           totalRows: rows.length,
           executionTime
         };

        // Log da query
        const connection2 = await pool.getConnection();
        await connection2.execute(
          'INSERT INTO query_logs (user_id, cluster_id, query_text, execution_time_ms, rows_returned, status) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user.id, clusterId, query, executionTime, queryResult.totalRows, 'success']
        );
        connection2.release();

        // Log de auditoria
        await logAudit(req.user.id, 'EXECUTE_QUERY', 'CLUSTER', clusterId, { query, executionTime, rowsReturned: queryResult.totalRows }, req);

        res.json(queryResult);

      } catch (cassandraError) {
        console.error('Erro na conexão/execução Cassandra:', cassandraError.message || cassandraError);
        // Fechar conexão em caso de erro
        try {
          await cassandraClient.shutdown();
        } catch (shutdownError) {
          console.error('Erro ao fechar conexão Cassandra:', shutdownError);
        }
        throw cassandraError;
      }

    } catch (queryError) {
      console.error('Erro geral na execução da query:', queryError.message || queryError);
      const executionTime = Date.now() - startTime;

      // Log de erro da query
      const connection3 = await pool.getConnection();
      await connection3.execute(
        'INSERT INTO query_logs (user_id, cluster_id, query_text, execution_time_ms, rows_returned, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, clusterId, query, executionTime, 0, 'error', queryError.message]
      );
      connection3.release();

      // Log de auditoria
      await logAudit(req.user.id, 'EXECUTE_QUERY_ERROR', 'CLUSTER', clusterId, { query, error: queryError.message }, req);

      res.status(500).json({ error: 'Erro ao executar query: ' + queryError.message });
    }

  } catch (error) {
    console.error('Erro na execução da query:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para listar usuários (apenas admin)
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT id, username, email, full_name, role, is_active, created_at, last_login FROM users ORDER BY created_at DESC'
    );
    connection.release();

    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para criar usuário (apenas admin)
app.post('/api/users', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { username, email, password, full_name, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email e password são obrigatórios' });
    }

    // Verificar se usuário já existe
    const connection = await pool.getConnection();
    const [existingUsers] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    );

    if (existingUsers.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'Username ou email já existe' });
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Inserir usuário
    const [result] = await connection.execute(
      'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [username, email, passwordHash, full_name || null, role || 'user']
    );
    connection.release();

    // Log de auditoria
    await logAudit(req.user.id, 'CREATE_USER', 'USER', result.insertId, { username, email, role: role || 'user' }, req);

    res.status(201).json({ 
      message: 'Usuário criado com sucesso',
      id: result.insertId 
    });

  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar usuário (apenas admin)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const userId = req.params.id;
    const { username, email, full_name, role, is_active, password } = req.body;

    const connection = await pool.getConnection();

    // Verificar se usuário existe
    const [existingUser] = await connection.execute(
      'SELECT * FROM users WHERE id = ?',
      [userId]
    );

    if (existingUser.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Construir query dinamicamente
    let updateFields = [];
    let updateValues = [];

    if (username !== undefined) {
      updateFields.push('username = ?');
      updateValues.push(username);
    }
    if (email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(email);
    }
    if (full_name !== undefined) {
      updateFields.push('full_name = ?');
      updateValues.push(full_name);
    }
    if (role !== undefined) {
      updateFields.push('role = ?');
      updateValues.push(role);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      updateFields.push('password_hash = ?');
      updateValues.push(passwordHash);
    }

    if (updateFields.length === 0) {
      connection.release();
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updateValues.push(userId);

    await connection.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );
    connection.release();

    // Log de auditoria
    await logAudit(req.user.id, 'UPDATE_USER', 'USER', userId, req.body, req);

    res.json({ message: 'Usuário atualizado com sucesso' });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para deletar usuário (apenas admin)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const userId = req.params.id;

    // Não permitir deletar a si mesmo
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário' });
    }

    const connection = await pool.getConnection();

    // Verificar se usuário existe
    const [existingUser] = await connection.execute(
      'SELECT username FROM users WHERE id = ?',
      [userId]
    );

    if (existingUser.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
    connection.release();

    // Log de auditoria
    await logAudit(req.user.id, 'DELETE_USER', 'USER', userId, { username: existingUser[0].username }, req);

    res.json({ message: 'Usuário deletado com sucesso' });

  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para logs de queries
app.get('/api/logs/queries', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 50, userId, clusterId } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let params = [];

    if (req.user.role !== 'admin') {
      whereClause += ' AND ql.user_id = ?';
      params.push(req.user.id);
    } else if (userId) {
      whereClause += ' AND ql.user_id = ?';
      params.push(userId);
    }

    if (clusterId) {
      whereClause += ' AND ql.cluster_id = ?';
      params.push(clusterId);
    }

    params.push(parseInt(limit), parseInt(offset));

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        ql.*,
        u.username,
        cc.name as cluster_name
      FROM query_logs ql
      JOIN users u ON ql.user_id = u.id
      JOIN cassandra_clusters cc ON ql.cluster_id = cc.id
      WHERE ${whereClause}
      ORDER BY ql.created_at DESC
      LIMIT ? OFFSET ?
    `, params);
    connection.release();

    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar logs:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para logs de auditoria (apenas admin)
app.get('/api/logs/audit', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const connection = await pool.getConnection();
    const [rows] = await connection.execute(`
      SELECT 
        al.*,
        u.username
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), parseInt(offset)]);
    connection.release();

    res.json(rows);
  } catch (error) {
    console.error('Erro ao listar logs de auditoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Inicializar servidor
const startServer = async () => {
  try {
    // Configurar pool de conexões MySQL
    pool = mysql.createPool(dbConfig);

    // Testar conexão
    const connection = await pool.getConnection();
    console.log('Conectado ao MySQL com sucesso');
    connection.release();

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });

  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer(); 