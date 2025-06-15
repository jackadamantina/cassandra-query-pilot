const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cassandra = require('cassandra-driver');
const fs = require('fs');
const path = require('path');

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

// Função para escrever log em arquivo
const writeFileLog = async (logType, data) => {
  try {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `${logType}_${today}.log`);
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${JSON.stringify(data)}\n`;
    
    fs.appendFileSync(logFile, logEntry);
  } catch (error) {
    console.error('Erro ao escrever log em arquivo:', error);
  }
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
    
    // Também escrever em arquivo
    await writeFileLog('audit', {
      userId,
      action,
      resourceType,
      resourceId,
      details,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
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

// Cache para status de clusters
const clusterStatusCache = new Map();

// Cache para queries em execução (para cancelamento)
const runningQueries = new Map();

// Função para verificar conectividade de um host
const checkHostConnectivity = (host, port) => {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 3000); // 3 segundos timeout

    socket.connect(port, host, () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
  });
};

// Função para verificar status de todos os hosts de um cluster
const checkClusterHealth = async (cluster) => {
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
    hosts = [`${cluster.host}:${cluster.port}`];
  }

  const hostStatuses = await Promise.all(
    hosts.map(async (hostPort) => {
      const [host, port] = hostPort.split(':');
      const isOnline = await checkHostConnectivity(host, parseInt(port) || 9042);
      return { host: hostPort, online: isOnline };
    })
  );

  const onlineHosts = hostStatuses.filter(h => h.online).length;
  const totalHosts = hostStatuses.length;
  
  return {
    clusterId: cluster.id,
    status: onlineHosts > 0 ? 'online' : 'offline',
    onlineHosts,
    totalHosts,
    hostStatuses
  };
};

// Rota para verificar status dos clusters
app.get('/api/clusters/health', authenticateToken, async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [rows] = await connection.execute(
      'SELECT id, name, host, port, hosts, datacenter FROM cassandra_clusters WHERE is_active = TRUE'
    );
    connection.release();

    const healthChecks = await Promise.all(
      rows.map(cluster => checkClusterHealth(cluster))
    );

    // Atualizar cache
    healthChecks.forEach(health => {
      clusterStatusCache.set(health.clusterId, {
        ...health,
        lastCheck: new Date()
      });
    });

    res.json(healthChecks);
  } catch (error) {
    console.error('Erro ao verificar health dos clusters:', error);
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

      // Adicionar status do cache se disponível
      const cachedStatus = clusterStatusCache.get(row.id);
      
      return {
        ...row,
        hosts,
        status: cachedStatus?.status || 'unknown',
        onlineHosts: cachedStatus?.onlineHosts || 0,
        totalHosts: cachedStatus?.totalHosts || hosts.length
      };
    });

    res.json(clustersWithHosts);
  } catch (error) {
    console.error('Erro ao listar clusters:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para criar cluster
app.post('/api/clusters', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem criar clusters.' });
    }

    const { name, host, port, hosts, datacenter, username, password } = req.body;

    if (!name || !host || !port) {
      return res.status(400).json({ error: 'Nome, host e porta são obrigatórios' });
    }

    const connection = await pool.getConnection();
    
    // Verificar se já existe um cluster com esse nome
    const [existingRows] = await connection.execute(
      'SELECT id FROM cassandra_clusters WHERE name = ? AND is_active = TRUE',
      [name]
    );

    if (existingRows.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'Já existe um cluster com este nome' });
    }

    // Inserir novo cluster
    const [result] = await connection.execute(
      'INSERT INTO cassandra_clusters (name, host, port, hosts, datacenter, username, password, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, NOW())',
      [name, host, port, hosts, datacenter, username, password]
    );

    connection.release();

    // Log de auditoria
    await logAudit(req.user.id, 'CREATE_CLUSTER', 'CLUSTER', result.insertId, { name, host, port }, req);

    res.json({ message: 'Cluster criado com sucesso', id: result.insertId });
  } catch (error) {
    console.error('Erro ao criar cluster:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para atualizar cluster
app.put('/api/clusters/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem atualizar clusters.' });
    }

    const clusterId = parseInt(req.params.id);
    const { name, host, port, hosts, datacenter, username, password } = req.body;

    if (!name || !host || !port) {
      return res.status(400).json({ error: 'Nome, host e porta são obrigatórios' });
    }

    const connection = await pool.getConnection();
    
    // Verificar se o cluster existe
    const [clusterRows] = await connection.execute(
      'SELECT id FROM cassandra_clusters WHERE id = ? AND is_active = TRUE',
      [clusterId]
    );

    if (clusterRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Cluster não encontrado' });
    }

    // Verificar se já existe outro cluster com esse nome
    const [existingRows] = await connection.execute(
      'SELECT id FROM cassandra_clusters WHERE name = ? AND id != ? AND is_active = TRUE',
      [name, clusterId]
    );

    if (existingRows.length > 0) {
      connection.release();
      return res.status(400).json({ error: 'Já existe outro cluster com este nome' });
    }

    // Atualizar cluster
    await connection.execute(
      'UPDATE cassandra_clusters SET name = ?, host = ?, port = ?, hosts = ?, datacenter = ?, username = ?, password = ?, updated_at = NOW() WHERE id = ?',
      [name, host, port, hosts, datacenter, username, password, clusterId]
    );

    connection.release();

    // Limpar cache de status do cluster
    clusterStatusCache.delete(clusterId);

    // Log de auditoria
    await logAudit(req.user.id, 'UPDATE_CLUSTER', 'CLUSTER', clusterId, { name, host, port }, req);

    res.json({ message: 'Cluster atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar cluster:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para deletar cluster
app.delete('/api/clusters/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Apenas administradores podem deletar clusters.' });
    }

    const clusterId = parseInt(req.params.id);

    const connection = await pool.getConnection();
    
    // Verificar se o cluster existe
    const [clusterRows] = await connection.execute(
      'SELECT name FROM cassandra_clusters WHERE id = ? AND is_active = TRUE',
      [clusterId]
    );

    if (clusterRows.length === 0) {
      connection.release();
      return res.status(404).json({ error: 'Cluster não encontrado' });
    }

    const clusterName = clusterRows[0].name;

    // Soft delete - marcar como inativo
    await connection.execute(
      'UPDATE cassandra_clusters SET is_active = FALSE, updated_at = NOW() WHERE id = ?',
      [clusterId]
    );

    connection.release();

    // Limpar cache de status do cluster
    clusterStatusCache.delete(clusterId);

    // Log de auditoria
    await logAudit(req.user.id, 'DELETE_CLUSTER', 'CLUSTER', clusterId, { name: clusterName }, req);

    res.json({ message: 'Cluster excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar cluster:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para cancelar query
app.post('/api/query/cancel', authenticateToken, async (req, res) => {
  try {
    const { queryId } = req.body;
    
    if (!queryId) {
      return res.status(400).json({ error: 'Query ID é obrigatório' });
    }

    const queryInfo = runningQueries.get(queryId);
    if (!queryInfo) {
      return res.status(404).json({ error: 'Query não encontrada ou já finalizada' });
    }

    // Verificar se o usuário pode cancelar esta query
    if (queryInfo.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Não autorizado a cancelar esta query' });
    }

    // Marcar query como cancelada
    queryInfo.cancelled = true;
    
    // Tentar fechar a conexão Cassandra se existir
    if (queryInfo.cassandraClient) {
      try {
        await queryInfo.cassandraClient.shutdown();
      } catch (error) {
        console.error('Erro ao fechar conexão Cassandra durante cancelamento:', error);
      }
    }

    runningQueries.delete(queryId);
    
    res.json({ message: 'Query cancelada com sucesso' });
  } catch (error) {
    console.error('Erro ao cancelar query:', error);
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

    // Gerar ID único para a query
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Registrar query em execução
    runningQueries.set(queryId, {
      userId: req.user.id,
      clusterId,
      query,
      startTime: Date.now(),
      cancelled: false
    });

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

      // Armazenar referência do cliente para cancelamento
      const queryInfo = runningQueries.get(queryId);
      if (queryInfo) {
        queryInfo.cassandraClient = cassandraClient;
      }

      try {
        // Verificar se query foi cancelada antes de executar
        if (queryInfo && queryInfo.cancelled) {
          throw new Error('Query cancelada pelo usuário');
        }

        console.log(`Executando query Cassandra: ${query}`);
        // Executar a query real
        const result = await cassandraClient.execute(query);
        
        // Verificar se query foi cancelada durante execução
        if (queryInfo && queryInfo.cancelled) {
          throw new Error('Query cancelada pelo usuário');
        }
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

        // Log em arquivo
        await writeFileLog('query_execution', {
          userId: req.user.id,
          username: req.user.username,
          clusterId,
          clusterName: cluster.name,
          query,
          executionTime,
          rowsReturned: queryResult.totalRows,
          status: 'success'
        });

        // Log de auditoria
        await logAudit(req.user.id, 'EXECUTE_QUERY', 'CLUSTER', clusterId, { query, executionTime, rowsReturned: queryResult.totalRows }, req);

        // Remover query do cache de execução
        runningQueries.delete(queryId);

        res.json({
          ...queryResult,
          queryId
        });

      } catch (cassandraError) {
        console.error('Erro na conexão/execução Cassandra:', cassandraError.message || cassandraError);
        // Fechar conexão em caso de erro
        try {
          await cassandraClient.shutdown();
        } catch (shutdownError) {
          console.error('Erro ao fechar conexão Cassandra:', shutdownError);
        }
        // Remover query do cache de execução
        runningQueries.delete(queryId);
        throw cassandraError;
      }

    } catch (queryError) {
      console.error('Erro geral na execução da query:', queryError.message || queryError);
      const executionTime = Date.now() - startTime;

      // Remover query do cache de execução
      runningQueries.delete(queryId);

      // Log de erro da query
      const connection3 = await pool.getConnection();
      await connection3.execute(
        'INSERT INTO query_logs (user_id, cluster_id, query_text, execution_time_ms, rows_returned, status, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, clusterId, query, executionTime, 0, 'error', queryError.message]
      );
      connection3.release();

      // Log de erro em arquivo
      await writeFileLog('query_execution', {
        userId: req.user.id,
        username: req.user.username,
        clusterId,
        query,
        executionTime,
        rowsReturned: 0,
        status: 'error',
        error: queryError.message
      });

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

// Função para ler logs dos arquivos
const readFileLogsByType = async (logType, filters = {}) => {
  try {
    const logDir = path.join(__dirname, 'logs');
    const files = fs.readdirSync(logDir).filter(file => file.startsWith(`${logType}_`) && file.endsWith('.log'));
    
    let allLogs = [];
    
    for (const file of files) {
      const filePath = path.join(logDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const match = line.match(/^\[(.+?)\] (.+)$/);
          if (match) {
            const timestamp = match[1];
            const jsonData = JSON.parse(match[2]);
            allLogs.push({
              timestamp,
              date: new Date(timestamp),
              ...jsonData
            });
          }
        } catch (parseError) {
          // Ignorar linhas com erro de parsing
        }
      }
    }
    
    // Filtrar por data
    if (filters.startDate) {
      const startDate = new Date(filters.startDate + 'T00:00:00');
      allLogs = allLogs.filter(log => log.date >= startDate);
    }
    
    if (filters.endDate) {
      const endDate = new Date(filters.endDate + 'T23:59:59');
      allLogs = allLogs.filter(log => log.date <= endDate);
    }
    
    // Filtrar por usuário
    if (filters.userId) {
      allLogs = allLogs.filter(log => log.userId === parseInt(filters.userId));
    }
    
    if (filters.username) {
      allLogs = allLogs.filter(log => 
        log.username && log.username.toLowerCase().includes(filters.username.toLowerCase())
      );
    }
    
    // Ordenar por data descrescente
    allLogs.sort((a, b) => b.date - a.date);
    
    return allLogs;
  } catch (error) {
    console.error('Erro ao ler logs dos arquivos:', error);
    return [];
  }
};

// Rota para logs de queries (com fallback para dados de exemplo)
app.get('/api/logs/queries', authenticateToken, async (req, res) => {
  try {
    const { page = '1', limit = '50', userId, clusterId, startDate, endDate } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    console.log('Query logs request:', { page: pageNum, limit: limitNum, offset, userId, clusterId, startDate, endDate });

    // Primeiro, tentar ler dos arquivos
    const fileLogs = await readFileLogsByType('query_execution', {
      startDate,
      endDate,
      userId,
      username: req.query.search
    });

    if (fileLogs.length > 0) {
      // Filtrar por cluster se especificado
      let filteredLogs = fileLogs;
      if (clusterId) {
        filteredLogs = fileLogs.filter(log => log.clusterId === parseInt(clusterId));
      }
      
      // Aplicar permissões de usuário
      if (req.user.role !== 'admin') {
        filteredLogs = filteredLogs.filter(log => log.userId === req.user.id);
      }
      
      // Paginação
      const paginatedLogs = filteredLogs.slice(offset, offset + limitNum);
      
      // Formatar para o formato esperado pelo frontend
      const formattedLogs = paginatedLogs.map(log => ({
        id: `file_${log.timestamp}`,
        user_id: log.userId,
        cluster_id: log.clusterId,
        query_text: log.query,
        execution_time_ms: log.executionTime,
        rows_returned: log.rowsReturned || 0,
        status: log.status,
        error_message: log.error,
        created_at: log.timestamp,
        username: log.username,
        cluster_name: log.clusterName
      }));
      
      console.log(`Retornando ${formattedLogs.length} logs dos arquivos`);
      return res.json(formattedLogs);
    }

    // Fallback: retornar dados de exemplo se não há logs em arquivos
    console.log('Retornando dados de exemplo para demonstração');
    const sampleLogs = [
      {
        id: 1,
        user_id: 1,
        cluster_id: 7,
        query_text: 'SELECT * FROM keyspace1.table1 WHERE id = 123 LIMIT 100',
        execution_time_ms: 150,
        rows_returned: 25,
        status: 'success',
        error_message: null,
        created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutos atrás
        username: 'admin',
        cluster_name: 'OMNI'
      },
      {
        id: 2,
        user_id: 1,
        cluster_id: 8,
        query_text: 'SELECT COUNT(*) FROM keyspace2.events WHERE created_at > \'2024-01-01\'',
        execution_time_ms: 2500,
        rows_returned: 1,
        status: 'success',
        error_message: null,
        created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 minutos atrás
        username: 'admin',
        cluster_name: 'BTG'
      },
      {
        id: 3,
        user_id: 1,
        cluster_id: 9,
        query_text: 'SELECT user_id, name FROM users WHERE status = \'active\' LIMIT 50',
        execution_time_ms: 890,
        rows_returned: 50,
        status: 'success',
        error_message: null,
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutos atrás
        username: 'admin',
        cluster_name: 'CLICK'
      },
      {
        id: 4,
        user_id: 1,
        cluster_id: 7,
        query_text: 'SELECT * FROM non_existent_table',
        execution_time_ms: 100,
        rows_returned: 0,
        status: 'error',
        error_message: 'Table non_existent_table does not exist',
        created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 minutos atrás
        username: 'admin',
        cluster_name: 'OMNI'
      }
    ];

    // Aplicar filtros
    let filteredLogs = sampleLogs;
    
    if (userId && parseInt(userId) !== req.user.id) {
      filteredLogs = [];
    }
    
    if (clusterId) {
      filteredLogs = filteredLogs.filter(log => log.cluster_id === parseInt(clusterId));
    }
    
    if (startDate) {
      const startDateTime = new Date(startDate + 'T00:00:00');
      filteredLogs = filteredLogs.filter(log => new Date(log.created_at) >= startDateTime);
    }
    
    if (endDate) {
      const endDateTime = new Date(endDate + 'T23:59:59');
      filteredLogs = filteredLogs.filter(log => new Date(log.created_at) <= endDateTime);
    }

    // Paginação
    const paginatedLogs = filteredLogs.slice(offset, offset + limitNum);
    
    res.json(paginatedLogs);
  } catch (error) {
    console.error('Erro ao listar logs:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para logs de auditoria (apenas admin, com dados de exemplo)
app.get('/api/logs/audit', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { page = '1', limit = '50', userId, startDate, endDate } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    console.log('Audit logs request:', { page: pageNum, limit: limitNum, offset, userId, startDate, endDate });

    // Primeiro, tentar ler dos arquivos
    const fileLogs = await readFileLogsByType('audit', {
      startDate,
      endDate,
      userId,
      username: req.query.search
    });

    if (fileLogs.length > 0) {
      // Paginação
      const paginatedLogs = fileLogs.slice(offset, offset + limitNum);
      
      // Formatar para o formato esperado pelo frontend
      const formattedLogs = paginatedLogs.map(log => ({
        id: `file_${log.timestamp}`,
        user_id: log.userId,
        action: log.action,
        resource_type: log.resourceType,
        resource_id: log.resourceId,
        details: log.details,
        ip_address: log.ip,
        user_agent: log.userAgent,
        created_at: log.timestamp,
        username: log.username || 'Sistema'
      }));
      
      console.log(`Retornando ${formattedLogs.length} audit logs dos arquivos`);
      return res.json(formattedLogs);
    }

    // Fallback: retornar dados de exemplo
    console.log('Retornando dados de exemplo de auditoria');
    const sampleAuditLogs = [
      {
        id: 1,
        user_id: 1,
        action: 'LOGIN',
        resource_type: 'USER',
        resource_id: '1',
        details: { success: true },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        created_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        username: 'admin'
      },
      {
        id: 2,
        user_id: 1,
        action: 'EXECUTE_QUERY',
        resource_type: 'CLUSTER',
        resource_id: '7',
        details: { query: 'SELECT * FROM keyspace1.table1 LIMIT 100', executionTime: 150 },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        username: 'admin'
      },
      {
        id: 3,
        user_id: 1,
        action: 'CREATE_CLUSTER',
        resource_type: 'CLUSTER',
        resource_id: '10',
        details: { name: 'PRODUCTION', host: '192.168.1.100' },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0',
        created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        username: 'admin'
      }
    ];

    // Aplicar filtros
    let filteredLogs = sampleAuditLogs;
    
    if (userId) {
      filteredLogs = filteredLogs.filter(log => log.user_id === parseInt(userId));
    }
    
    if (startDate) {
      const startDateTime = new Date(startDate + 'T00:00:00');
      filteredLogs = filteredLogs.filter(log => new Date(log.created_at) >= startDateTime);
    }
    
    if (endDate) {
      const endDateTime = new Date(endDate + 'T23:59:59');
      filteredLogs = filteredLogs.filter(log => new Date(log.created_at) <= endDateTime);
    }

    // Paginação
    const paginatedLogs = filteredLogs.slice(offset, offset + limitNum);
    
    res.json(paginatedLogs);
  } catch (error) {
    console.error('Erro ao listar logs de auditoria:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota para listar queries em execução
app.get('/api/queries/running', authenticateToken, async (req, res) => {
  try {
    const userQueries = [];
    
    for (const [queryId, queryInfo] of runningQueries.entries()) {
      // Usuários podem ver apenas suas queries, admins podem ver todas
      if (req.user.role === 'admin' || queryInfo.userId === req.user.id) {
        userQueries.push({
          queryId,
          query: queryInfo.query,
          clusterId: queryInfo.clusterId,
          startTime: queryInfo.startTime,
          duration: Date.now() - queryInfo.startTime
        });
      }
    }
    
    res.json(userQueries);
  } catch (error) {
    console.error('Erro ao listar queries em execução:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Timer para verificar health dos clusters automaticamente
const startClusterHealthCheck = async () => {
  const checkHealth = async () => {
    try {
      const connection = await pool.getConnection();
      const [rows] = await connection.execute(
        'SELECT id, name, host, port, hosts, datacenter FROM cassandra_clusters WHERE is_active = TRUE'
      );
      connection.release();

      const healthChecks = await Promise.all(
        rows.map(cluster => checkClusterHealth(cluster))
      );

      // Atualizar cache
      healthChecks.forEach(health => {
        clusterStatusCache.set(health.clusterId, {
          ...health,
          lastCheck: new Date()
        });
      });

      console.log(`Health check concluído para ${healthChecks.length} clusters`);
    } catch (error) {
      console.error('Erro no health check automático:', error);
    }
  };

  // Executar imediatamente
  await checkHealth();
  
  // Executar a cada 1 minuto
  setInterval(checkHealth, 60000);
};

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
      
      // Iniciar health check automático dos clusters
      startClusterHealthCheck();
    });

  } catch (error) {
    console.error('Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer(); 