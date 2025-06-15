const API_BASE_URL = '/api';

// Tipos para as respostas da API
export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  created_at: string;
  last_login?: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Cluster {
  id: number;
  name: string;
  host: string;
  port: number;
  hosts: string[];
  datacenter: string;
  status: 'online' | 'offline' | 'unknown';
  onlineHosts: number;
  totalHosts: number;
}

export interface QueryResult {
  columns: string[];
  rows: string[][];
  totalRows: number;
  executionTime: number;
}

export interface QueryLog {
  id: number;
  user_id: number;
  cluster_id: number;
  query_text: string;
  execution_time_ms: number;
  rows_returned: number;
  status: 'success' | 'error' | 'timeout';
  error_message?: string;
  created_at: string;
  username: string;
  cluster_name: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  action: string;
  resource_type: string;
  resource_id: string;
  details: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  username: string;
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('authToken');
  }

  private getHeaders() {
    // Sempre verificar o token mais recente do localStorage
    this.token = localStorage.getItem('authToken');
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Autenticação
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    this.token = response.token;
    localStorage.setItem('authToken', response.token);
    
    return response;
  }

  logout() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

  // Clusters
  async getClusters(): Promise<Cluster[]> {
    return this.request<Cluster[]>('/clusters');
  }

  async getClustersHealth(): Promise<any[]> {
    return this.request<any[]>('/clusters/health');
  }

  async createCluster(clusterData: {
    name: string;
    host: string;
    port: number;
    hosts: string;
    datacenter: string;
    username?: string | null;
    password?: string | null;
  }): Promise<{ message: string; id: number }> {
    return this.request<{ message: string; id: number }>('/clusters', {
      method: 'POST',
      body: JSON.stringify(clusterData),
    });
  }

  async updateCluster(id: number, clusterData: {
    name: string;
    host: string;
    port: number;
    hosts: string;
    datacenter: string;
    username?: string | null;
    password?: string | null;
  }): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/clusters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(clusterData),
    });
  }

  async deleteCluster(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/clusters/${id}`, {
      method: 'DELETE',
    });
  }

  // Queries
  async executeQuery(clusterId: number, query: string): Promise<QueryResult & { queryId: string }> {
    return this.request<QueryResult & { queryId: string }>('/query/execute', {
      method: 'POST',
      body: JSON.stringify({ clusterId, query }),
    });
  }

  async cancelQuery(queryId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/query/cancel', {
      method: 'POST',
      body: JSON.stringify({ queryId }),
    });
  }

  async getRunningQueries(): Promise<any[]> {
    return this.request<any[]>('/queries/running');
  }

  // Usuários
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async createUser(userData: {
    username: string;
    email: string;
    password: string;
    full_name?: string;
    role?: 'admin' | 'user' | 'viewer';
  }): Promise<{ message: string; id: number }> {
    return this.request<{ message: string; id: number }>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: number, userData: Partial<User & { password?: string }>): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Logs
  async getQueryLogs(page = 1, limit = 50, userId?: number, clusterId?: number, startDate?: string, endDate?: string): Promise<QueryLog[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (userId) params.append('userId', userId.toString());
    if (clusterId) params.append('clusterId', clusterId.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.request<QueryLog[]>(`/logs/queries?${params}`);
  }

  async getAuditLogs(page = 1, limit = 50, userId?: number, startDate?: string, endDate?: string): Promise<AuditLog[]> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (userId) params.append('userId', userId.toString());
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    return this.request<AuditLog[]>(`/logs/audit?${params}`);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }
}

export const apiService = new ApiService(); 