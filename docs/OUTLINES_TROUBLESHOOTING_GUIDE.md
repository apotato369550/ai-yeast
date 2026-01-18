# Outlines Troubleshooting Guide

## Quick Start

### Start Outlines server on apollo.local

```bash
ssh apollo.local "cd ~/yeast && node scripts/outlines-server.js"
```

Or with nohup (background):

```bash
ssh apollo.local "nohup node ~/yeast/scripts/outlines-server.js > ~/logs/outlines-server.log 2>&1 &"
```

### Verify it's running

```bash
ssh apollo.local "curl -s http://localhost:8000/health"
```

**Expected output** (healthy):
```json
{"status": "ok", "api": "Outlines"}
```

Check process:
```bash
ssh apollo.local "ps aux | grep outlines"
```

---

## Troubleshooting

### Check logs

```bash
ssh apollo.local "tail -f ~/logs/outlines-server.log"
```

### Common Issues

**Port 8000 already in use**:
```bash
ssh apollo.local "lsof -i :8000"
kill -9 <PID>
```

**Ollama down or unreachable**:
```bash
ssh apollo.local "ollama list"           # Check if ollama is running
ssh apollo.local "curl http://localhost:11434/api/tags"  # Test Ollama API
```

**Mistral model not loaded**:
```bash
ssh apollo.local "ollama pull mistral:7b-instruct"
```

### Kill stuck processes

```bash
ssh apollo.local "pkill -f outlines"
ssh apollo.local "pkill -f 'node.*outlines'"
```

---

## Auto-start on Boot

### Create systemd service

**File**: `/etc/systemd/system/outlines.service`

```ini
[Unit]
Description=Outlines.dev API Server
After=network.target ollama.service

[Service]
Type=simple
User=jay
WorkingDirectory=/home/jay/yeast
ExecStart=/usr/bin/node /home/jay/yeast/scripts/outlines-server.js
Restart=on-failure
RestartSec=5s
StandardOutput=append:/home/jay/logs/outlines-server.log
StandardError=append:/home/jay/logs/outlines-server.log

[Install]
WantedBy=multi-user.target
```

### Enable and start

```bash
ssh apollo.local "sudo systemctl daemon-reload"
ssh apollo.local "sudo systemctl enable outlines.service"
ssh apollo.local "sudo systemctl start outlines.service"
ssh apollo.local "sudo systemctl status outlines.service"
```

### View logs

```bash
ssh apollo.local "sudo journalctl -u outlines.service -f"
```
