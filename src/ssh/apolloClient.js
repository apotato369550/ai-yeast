import { NodeSSH } from 'node-ssh';
import config from '../config.js';

class ApolloClient {
  constructor() {
    this.connections = [];
    this.maxConnections = 3;
    this.retryAttempts = 5;
    this.retryDelays = [100, 200, 400, 800, 1600];
  }

  async getConnection() {
    for (let i = 0; i < this.connections.length; i++) {
      const conn = this.connections[i];
      if (conn && !conn.inUse) {
        conn.inUse = true;
        return conn;
      }
    }

    if (this.connections.length < this.maxConnections) {
      return await this.createConnection();
    }

    for (let attempt = 0; attempt < 50; attempt++) {
      await new Promise((r) => setTimeout(r, 100));
      for (let i = 0; i < this.connections.length; i++) {
        const conn = this.connections[i];
        if (conn && !conn.inUse) {
          conn.inUse = true;
          return conn;
        }
      }
    }

    throw new Error('No SSH connections available after timeout');
  }

  async createConnection() {
    let lastError;
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const ssh = new NodeSSH();
        await ssh.connect({
          host: config.APOLLO_HOST,
          username: config.APOLLO_USER,
          port: config.APOLLO_PORT,
          readyTimeout: config.SSH_TIMEOUT_MS,
          privateKeyPath: config.SSH_PRIVATE_KEY_PATH,
        });

        const connObj = { ssh, inUse: true };
        this.connections.push(connObj);
        return connObj;
      } catch (error) {
        lastError = error;
        if (attempt < this.retryAttempts - 1) {
          const delay = this.retryDelays[attempt];
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    throw new Error(`Failed to connect to ${config.APOLLO_HOST}: ${lastError.message}`);
  }

  releaseConnection(connObj) {
    if (connObj) connObj.inUse = false;
  }

  async sendCommand(command, input, thinkingEnabled = false, thinkingBudget = 1500, ragDocs = []) {
    let connObj;
    try {
      connObj = await this.getConnection();
      const { ssh } = connObj;

      const payload = {
        command,
        input,
        thinking_enabled: thinkingEnabled,
        thinking_budget: thinkingBudget,
        rag_docs: ragDocs,
        memory_context: { episodic_count: 0, semantic_count: 0 },
      };

      const result = await Promise.race([
        ssh.execCommand(`node ~/yeast-agent.js`, { stdin: JSON.stringify(payload) }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('SSH timeout')), config.SSH_TIMEOUT_MS)),
      ]);

      if (result.code === 0) {
        try {
          return JSON.parse(result.stdout);
        } catch (parseError) {
          return {
            success: false,
            error: 'Failed to parse agent response',
            error_code: 'PARSING_ERROR',
            timestamp: new Date().toISOString(),
          };
        }
      } else {
        return {
          success: false,
          error: result.stderr || 'Agent error',
          error_code: 'AGENT_ERROR',
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        error_code: error.message.includes('timeout') ? 'CONNECTION_TIMEOUT' : 'CONNECTION_ERROR',
        recovery: 'Check SSH config with /config show',
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.releaseConnection(connObj);
    }
  }

  async closeAll() {
    for (const connObj of this.connections) {
      try {
        await connObj.ssh.dispose();
      } catch (error) {
        console.error('Error closing SSH connection:', error);
      }
    }
    this.connections = [];
  }
}

export default new ApolloClient();
