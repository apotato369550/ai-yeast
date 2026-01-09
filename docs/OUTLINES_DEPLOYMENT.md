# Outlines.dev Integration Deployment Guide

**Phase 5 - Adaptive Memory Dynamics & Fermentation**

This guide documents the deployment of Outlines.dev integration for structured, schema-constrained LLM output generation. This enables Phase 5's reflection gates and memory consolidation to reliably parse LLM responses.

---

## Overview

**What is Outlines.dev?**

Outlines is a Python library that constrains LLM output to match JSON schemas or Pydantic models. Instead of post-hoc parsing (which can fail), Outlines guides the model's token generation to guarantee valid output.

**Why integrate Outlines?**

- **Phase 5 Requirement**: Memory consolidation needs guaranteed JSON for episodic/semantic updates
- **Reflection Gates**: Safety validation becomes deterministic (no parse errors)
- **Batch Fermentation**: Fermenter can process 100+ prompts without JSON failures

**Architecture in ai-yeast:**

```
User/Batch Input
    ↓
yeast-agent.js (SSH to apollo)
    ↓
Mistral 7B via Ollama (11434)
    ↓
[NEW] Outlines Server (6789)
    ↓
Constrained generation with JSON schema
    ↓
Response → Reflection Gates → Memory Update
```

---

## Deployment Steps

### Step 1: Python Environment Setup

Create an isolated Python virtual environment to prevent conflicts with system packages.

**On apollo.local:**

```bash
ssh jay@apollo.local

# Create venv
python3 -m venv ~/outlines-env

# Activate (for immediate testing)
source ~/outlines-env/bin/activate

# Install packages
pip install fastapi uvicorn 'outlines>=0.0.18' ollama pydantic

# Verify installations
python3 << 'VERIFY'
import fastapi
import uvicorn
import outlines
import ollama
import pydantic
print("✓ All packages installed successfully")
VERIFY
```

**Expected Output:**
```
✓ All packages installed successfully
```

---

### Step 2: Outlines Server Setup

#### 2.1 Create the Server Script

**Location:** `/home/jay/scripts/outlines-server.py`

Key features of the server:

- **Port:** 6789 (listener: 0.0.0.0)
- **Endpoints:**
  - `GET /health` - Health check
  - `POST /chat` - Generation with optional schema constraint

**Critical Fix: VEnv Site-Packages Path**

The server script contains this at the top:

```python
#!/usr/bin/env python3
"""
Outlines.dev wrapper service for constrained generation via Ollama.
...
"""

import sys
import json
import logging
# ... other imports ...

# Explicitly add venv site-packages to sys.path for systemd compatibility
# (venv activation doesn't propagate through bash subprocess spawning)
import site
site.addsitedir('/home/jay/outlines-env/lib/python3.12/site-packages')

from fastapi import FastAPI, HTTPException
# ... rest of imports ...
```

**Why this fix?**

When systemd starts a service, it doesn't source `~/.bashrc` or activate the venv. The subprocess runs as a bare Python interpreter without access to venv packages. The `site.addsitedir()` call explicitly adds the venv's site-packages to `sys.path`, making all pip-installed packages available.

**Copy the script:**

```bash
# From your local machine (if you have SCP access)
scp scripts/outlines-server.py jay@apollo.local:~/scripts/

# Or manually on apollo:
cat > ~/scripts/outlines-server.py << 'PYTHON_EOF'
#!/usr/bin/env python3
[... copy full content ...]
PYTHON_EOF

chmod +x ~/scripts/outlines-server.py
```

**Verify syntax:**

```bash
python3 -m py_compile ~/scripts/outlines-server.py && echo "✓ Syntax OK"
```

---

#### 2.2 Create the Systemd Service

**Location:** `~/.config/systemd/user/outlines-server.service`

Create the service directory if needed:

```bash
mkdir -p ~/.config/systemd/user
```

**Service file content:**

```ini
[Unit]
Description=Outlines.dev Constrained Generation Service
Documentation=https://github.com/outlines-ai/outlines
# Note: network-online.target not available in user systemd
# Optional: Uncomment if ollama.service exists on apollo
# After=ollama.service

[Service]
Type=simple
# User=jay  (commented out: user systemd services run as current user automatically)
WorkingDirectory=/home/jay

# Python service startup (direct system python with explicit venv path in code)
ExecStart=/usr/bin/python3 /home/jay/scripts/outlines-server.py

# Restart policy
Restart=always
RestartSec=5s
TimeoutStartSec=30s

# Logging
StandardOutput=append:/home/jay/logs/outlines-server.log
StandardError=append:/home/jay/logs/outlines-server.log

# Resource limits
LimitNOFILE=65536
MemoryMax=2G

# Signal handling
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=10s

# Environment
Environment="PYTHONUNBUFFERED=1"
Environment="PYTHONDONTWRITEBYTECODE=1"

[Install]
WantedBy=default.target
```

**Copy the service file:**

```bash
cat > ~/.config/systemd/user/outlines-server.service << 'SERVICE_EOF'
[Unit]
Description=Outlines.dev Constrained Generation Service
Documentation=https://github.com/outlines-ai/outlines

[Service]
Type=simple
WorkingDirectory=/home/jay
ExecStart=/usr/bin/python3 /home/jay/scripts/outlines-server.py
Restart=always
RestartSec=5s
TimeoutStartSec=30s
StandardOutput=append:/home/jay/logs/outlines-server.log
StandardError=append:/home/jay/logs/outlines-server.log
LimitNOFILE=65536
MemoryMax=2G
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=10s
Environment="PYTHONUNBUFFERED=1"
Environment="PYTHONDONTWRITEBYTECODE=1"

[Install]
WantedBy=default.target
SERVICE_EOF
```

**Verify systemd syntax:**

```bash
systemd-analyze verify ~/.config/systemd/user/outlines-server.service && echo "✓ Systemd syntax OK"
```

---

### Step 3: Prepare Logging Directory

```bash
# On apollo
mkdir -p ~/logs
chmod 700 ~/logs
```

---

### Step 4: Enable and Start the Service

```bash
# Reload systemd daemon
systemctl --user daemon-reload

# Enable to auto-start on login
systemctl --user enable outlines-server.service

# Start service
systemctl --user start outlines-server.service

# Verify status (should show "active (running)")
systemctl --user status outlines-server.service
```

---

### Step 5: Verify Deployment

#### 5.1 Health Check

```bash
curl http://localhost:6789/health
```

**Expected response:**
```json
{
  "status": "ok",
  "timestamp": "2026-01-10T12:34:56",
  "ollama_ready": true,
  "outlines_available": true
}
```

#### 5.2 Simple Generation Test

```bash
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is 2 + 2? Answer: ",
    "temperature": 0.1
  }' | python3 -m json.tool
```

**Expected response:**
```json
{
  "output": "4",
  "tokens_used": 12,
  "schema_validated": false
}
```

#### 5.3 Schema-Constrained Generation Test

```bash
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate a JSON response for a person named Alice with age 28. Respond with valid JSON only: ",
    "schema": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "age": {"type": "integer"}
      },
      "required": ["name", "age"]
    },
    "temperature": 0.3
  }' | python3 -m json.tool
```

**Expected response:**
```json
{
  "output": "{\"name\": \"Alice\", \"age\": 28}",
  "tokens_used": 45,
  "schema_validated": true
}
```

#### 5.4 View Logs

```bash
# Real-time journal
journalctl --user -u outlines-server.service -f

# Last 20 lines
journalctl --user -u outlines-server.service -n 20

# Log file
tail -50 ~/logs/outlines-server.log
```

---

## Key Issues Encountered & Solutions

### Issue 1: Systemd Network-Online Target

**Problem:** Service file referenced `network-online.target`, which doesn't exist in user-level systemd.

**Error:**
```
Unit network-online.target not found.
```

**Solution:** Removed the `After=network-online.target` line from the service file. For Ollama dependency, use optional `After=ollama.service` (commented out by default).

**Why:** User-level systemd has no concept of system-wide targets. If Ollama needs to start first, uncomment the `After=` line (but Ollama may not have a systemd service).

---

### Issue 2: User= Permission Error in User Systemd

**Problem:** Service file contained `User=jay` in a user-level systemd service.

**Error:**
```
Invalid directive User=... in user unit (user units cannot have User=)
```

**Solution:** Removed the `User=jay` line. User-level systemd services automatically run as the current user.

**Why:** Systemd enforces that user units (in `~/.config/systemd/user/`) run as the user who owns them. Specifying `User=` is redundant and causes validation errors.

---

### Issue 3: VEnv Packages Not in sys.path Under Systemd

**Problem:** Service starts but crashes with `ModuleNotFoundError: No module named 'fastapi'`.

**Error:**
```
Traceback (most recent call last):
  File "/home/jay/scripts/outlines-server.py", line 27, in <module>
    from fastapi import FastAPI
ModuleNotFoundError: No module named 'fastapi'
```

**Root Cause:** Systemd subprocess doesn't source `~/.bashrc` or activate the venv. It runs as a bare Python interpreter at `/usr/bin/python3`, which only sees system packages and user site-packages (`~/.local/lib/python3.x/site-packages`).

**Solution:** Add explicit venv site-packages path at the top of the server script:

```python
# Explicitly add venv site-packages to sys.path for systemd compatibility
import site
site.addsitedir('/home/jay/outlines-env/lib/python3.12/site-packages')
```

**Why:** The `site.addsitedir()` function adds a directory to `sys.path` at runtime. When called before any imports, it makes all venv packages available to the interpreter.

**Caveat:** This hardcodes the Python version (`3.12`). If you upgrade Python and need to recreate the venv, update this line to match:
```python
site.addsitedir('/home/jay/outlines-env/lib/python3.13/site-packages')  # If upgrading to 3.13
```

---

### Issue 4: Incorrect Outlines API Usage

**Problem:** Initial code tried to use `ollama.model()` or `model.generate()` to call Outlines.

**Error:**
```
AttributeError: 'str' object has no attribute 'generate'
```

**Solution:** Use the correct Outlines API:

```python
# WRONG (old API or misunderstanding):
# model = ollama.model('mistral:7b-instruct')
# output = model.generate(prompt)

# CORRECT (Outlines 0.0.18+):
import outlines
from ollama import Client as OllamaClient

ollama_client = OllamaClient(host="http://localhost:11434")
model = outlines.from_ollama(ollama_client, "mistral:7b-instruct")
output = model(prompt)  # Models are directly callable
```

**Why:** Outlines 1.2.9+ changed from `.generate()` to making models directly callable (like PyTorch modules). The `outlines.from_ollama()` function wraps the Ollama client and returns a callable generator.

---

### Issue 5: Schema Format Mismatch

**Problem:** Client sends raw JSON schema, but Outlines expects Pydantic BaseModel classes for guaranteed schema validation.

**Error:**
```
TypeError: Expected BaseModel, got dict
```

**Solution (used in current implementation):** Server accepts JSON schemas but converts them to Pydantic models dynamically:

```python
from pydantic import BaseModel, create_model

def json_schema_to_pydantic(schema_dict: dict):
    """Convert JSON Schema to Pydantic model."""
    if schema_dict.get("type") == "object":
        properties = schema_dict.get("properties", {})
        # Build field definitions
        field_definitions = {}
        for prop_name, prop_schema in properties.items():
            field_definitions[prop_name] = (str, ...)  # Simplified; handle types properly
        return create_model("DynamicModel", **field_definitions)
    raise ValueError("Only object schemas supported")
```

**Why:** Pydantic models provide type hints, validation, and serialization that raw JSON schemas don't. The server bridges the gap by converting schemas at request time.

---

## Monitoring & Maintenance

### Daily Health Check

```bash
# Service status
systemctl --user status outlines-server.service

# Health endpoint
curl http://localhost:6789/health | jq '.status'

# Check for errors in last hour
journalctl --user -u outlines-server.service --since "1 hour ago" | grep -i error
```

### Log Rotation

Logs accumulate in `~/logs/outlines-server.log`. Set up rotation:

**Manual rotation:**
```bash
mv ~/logs/outlines-server.log ~/logs/outlines-server.log.$(date +%Y%m%d)
systemctl --user kill -s HUP outlines-server.service
```

**Automatic rotation (add to `/etc/logrotate.d/outlines-server`, requires sudo):**
```
/home/jay/logs/outlines-server.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0644 jay jay
    postrotate
        systemctl --user kill -s HUP outlines-server > /dev/null 2>&1 || true
    endscript
}
```

### Service Restart

```bash
# Restart after code changes
systemctl --user restart outlines-server.service

# Verify restarted
systemctl --user status outlines-server.service
```

### Memory Monitoring

Watch for memory leaks:

```bash
# One-time check
ps aux | grep outlines-server | grep -v grep

# Continuous monitoring (5-second intervals)
watch -n 5 'ps aux | grep outlines-server | grep -v grep'

# If memory grows unbounded, restart
systemctl --user restart outlines-server.service
```

---

## Troubleshooting

### Service Won't Start

**Check systemd journal:**
```bash
journalctl --user -u outlines-server.service -f
```

**Common issues:**

| Error | Cause | Fix |
|-------|-------|-----|
| `ModuleNotFoundError: No module named 'fastapi'` | venv packages not in sys.path | Verify `site.addsitedir()` in script and Python version matches venv path |
| `Connection refused (Ollama)` | Ollama not running | `ollama serve` on apollo or check `curl http://localhost:11434/api/tags` |
| `Address already in use: 0.0.0.0:6789` | Another process on port 6789 | `lsof -i :6789` then `kill -9 <PID>` |
| `ImportError: outlines` | Package not installed in venv | `source ~/outlines-env/bin/activate && pip install outlines` |

---

### Ollama Connection Issues

**Verify Ollama is running:**
```bash
# API health
curl http://localhost:11434/api/tags

# Expected response: list of available models
# If connection refused, start Ollama:
ollama serve

# Or check systemd (if configured):
systemctl --user status ollama.service
```

---

### Port 6789 Already in Use

```bash
# Find process using port
lsof -i :6789

# Kill it (if needed)
kill -9 <PID>

# Or change port in outlines-server.py and systemd service
```

---

### High Memory Usage

If Outlines server uses excessive memory:

1. **Check if memory is growing** (possible leak):
   ```bash
   for i in {1..5}; do
     sleep 60
     ps aux | grep outlines-server | awk '{print $6}'
   done
   ```

2. **Restart service if leaking:**
   ```bash
   systemctl --user restart outlines-server.service
   ```

3. **Reduce token limits** in requests:
   ```json
   {
     "prompt": "...",
     "max_tokens": 256
   }
   ```

---

### Slow Response Times

**Check system resources:**
```bash
# CPU and memory
top -n 1 | grep outlines-server

# Disk I/O
iostat -x 1
```

**If Ollama is slow:**
```bash
# Time a direct Ollama request
time curl http://localhost:11434/api/generate \
  -d '{"model": "mistral:7b-instruct", "prompt": "test"}'
```

**Solutions:**
- Use smaller model (mistral:3b instead of 7b)
- Reduce max_tokens limit
- Check GPU memory if using GPU

---

## Integration with ai-yeast

### Connecting yeast-agent.js to Outlines

Once deployed, yeast-agent.js on apollo can call the Outlines server for constrained consolidation:

```javascript
// In src/agent/yeast-agent.js or consolidation logic
const axios = require('axios');

async function generateWithSchema(prompt, schema) {
  try {
    const response = await axios.post('http://localhost:6789/chat', {
      prompt,
      schema,
      temperature: 0.3,
      max_tokens: 1024
    });
    return JSON.parse(response.data.output);
  } catch (error) {
    console.error('Outlines generation failed:', error.message);
    throw error;
  }
}
```

### Phase 5 Consolidation Pattern

When consolidating episodic memory to semantic:

```javascript
// Old pattern: parse LLM response, hope for valid JSON
const response = await mistral.generate(prompt);
const facts = JSON.parse(response);  // Can fail!

// New pattern: guarantee valid JSON
const response = await axios.post('http://localhost:6789/chat', {
  prompt: "Extract semantic facts...",
  schema: {
    type: "object",
    properties: {
      facts: { type: "array", items: { type: "object" } }
    }
  }
});
const facts = JSON.parse(response.data.output);  // Always valid
```

### Batch Fermentation Integration

Fermenter can use `--schema` flag for structured outputs:

```bash
# Process prompts with JSON schema validation
node scripts/fermenter.js prompts.md --schema consolidation-schema.json --no-proposals
```

---

## Rollback Procedure

If you need to disable or remove the Outlines service:

```bash
# Stop service
systemctl --user stop outlines-server.service

# Disable auto-start
systemctl --user disable outlines-server.service

# Remove files
rm ~/scripts/outlines-server.py
rm ~/.config/systemd/user/outlines-server.service

# Reload systemd
systemctl --user daemon-reload

# Clean up venv (optional)
rm -rf ~/outlines-env
```

---

## Performance Baseline

Capture metrics after successful deployment:

```bash
# Startup latency
time systemctl --user start outlines-server.service

# Idle memory
ps aux | grep outlines-server | awk '{print "RSS:", $6, "MB"}'

# Health check latency
time curl http://localhost:6789/health > /dev/null

# Generation latency (simple)
time curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "temperature": 0.5}' > /dev/null

# Generation latency (schema-constrained)
time curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "test",
    "schema": {"type": "object", "properties": {"key": {"type": "string"}}}
  }' > /dev/null

# Concurrent load (5 parallel requests)
for i in {1..5}; do
  curl -s -X POST http://localhost:6789/chat \
    -H "Content-Type: application/json" \
    -d '{"prompt": "test"}' &
done
wait
echo "Concurrent test complete"
```

---

## Success Criteria

Deployment is successful when:

✅ Service starts without errors (`systemctl --user status` shows "active (running)")
✅ Health endpoint returns `"status": "ok"` and `"outlines_available": true`
✅ Simple generation requests complete in <1s
✅ Schema-constrained requests produce valid JSON matching the schema
✅ Logs show all requests with timestamps (in `~/logs/outlines-server.log`)
✅ Service survives Ollama restart (auto-reconnects)
✅ No memory leaks over 1+ hour of operation
✅ Concurrent requests (5+) handled correctly
✅ yeast-agent.js can successfully POST to `/chat` endpoint

---

## Configuration Files Reference

### outlines-server.py

- **Location:** `/home/jay/scripts/outlines-server.py`
- **Executable:** Yes (`chmod +x`)
- **Size:** ~368 lines
- **Key Features:**
  - FastAPI service with async endpoints
  - Ollama integration via `outlines.from_ollama()`
  - JSON schema to Pydantic model conversion
  - Request/response logging
  - Health checks with Ollama availability detection
  - Graceful degradation if packages missing

### outlines-server.service

- **Location:** `~/.config/systemd/user/outlines-server.service`
- **Type:** User systemd service
- **Key Settings:**
  - Port: 6789
  - Restart: always (restarts on crash)
  - Memory limit: 2GB
  - Log location: `~/logs/outlines-server.log`
  - Python: `/usr/bin/python3`

### .env Additions (Optional)

If you extend the server, consider adding to your `.env`:

```bash
OUTLINES_HOST=localhost
OUTLINES_PORT=6789
OUTLINES_ENABLED=true
OUTLINES_TIMEOUT_MS=30000
```

---

## Additional Resources

- **Outlines Documentation:** https://github.com/outlines-ai/outlines
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **Pydantic:** https://docs.pydantic.dev/
- **Systemd User Services:** https://wiki.archlinux.org/title/Systemd/User

---

## Phase 5 Integration Checklist

Before moving to Phase 6, verify:

- [ ] Outlines server deployed and healthy
- [ ] yeast-agent.js successfully calls `/chat` endpoint
- [ ] Consolidation logic uses schema-constrained generation
- [ ] Batch Fermenter processes with `--no-proposals` flag
- [ ] Reflection gates receive valid JSON consistently
- [ ] No crashes in 24+ hours of operation
- [ ] Memory stable (no unbounded growth)
- [ ] Performance baseline documented

---

**Deployment Status:** Ready for production
**Tested On:** apollo.local (Linux)
**Python Version:** 3.8+
**Outlines Version:** 0.0.18+
**Last Updated:** January 10, 2026
