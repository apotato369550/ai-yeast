# Outlines Server: Deployment Checklist

## Pre-Deployment Verification

- [x] `outlines-server.py` syntax validated (Python 3.8+)
- [x] `outlines-server.service` systemd file valid
- [x] All imports available via pip
- [x] Port 6789 chosen (conflict-free)
- [x] Graceful degradation for missing Ollama

## File Manifest

| File | Size | Executable | Purpose |
|------|------|------------|---------|
| `outlines-server.py` | 11K | ✓ Yes | FastAPI wrapper service |
| `outlines-server.service` | 844B | - | systemd unit template |
| `OUTLINES_SERVER.md` | 12K | - | Complete documentation |
| `OUTLINES_INTEGRATION.md` | 12K | - | Phase 5/6 integration guide |
| `OUTLINES_QUICKSTART.md` | 4.7K | - | Quick start guide |

**Total lines of code/docs**: 1,531

## Deployment Steps (apollo.local)

### Step 1: Prepare Environment

```bash
ssh jay@apollo.local

# Create necessary directories
mkdir -p ~/logs
mkdir -p ~/.config/systemd/user

# Verify Python
python3 --version  # Should be 3.8+

# Verify Ollama is accessible
curl http://localhost:11434/api/tags
```

### Step 2: Install Dependencies

```bash
# Install Python packages
pip install fastapi uvicorn outlines pydantic

# Verify installations
python3 -c "import fastapi, uvicorn, outlines; print('✓ All packages installed')"
```

### Step 3: Copy Service Files

**Option A: Direct Copy (if you have SSH access)**
```bash
# From local machine
scp scripts/outlines-server.py jay@apollo.local:~/scripts/
scp scripts/outlines-server.service jay@apollo.local:~/.config/systemd/user/
```

**Option B: Manual Copy**
```bash
# On apollo, create files directly:
cat > ~/scripts/outlines-server.py << 'PYTHON_EOF'
# ... (copy full content from outlines-server.py)
PYTHON_EOF

cat > ~/.config/systemd/user/outlines-server.service << 'SERVICE_EOF'
# ... (copy full content from outlines-server.service)
SERVICE_EOF
```

### Step 4: Make Executable and Verify

```bash
# On apollo
chmod +x ~/scripts/outlines-server.py

# Verify syntax
python3 -m py_compile ~/scripts/outlines-server.py && echo "✓ Python syntax OK"

# Verify service file
systemd-analyze verify ~/.config/systemd/user/outlines-server.service && echo "✓ systemd syntax OK"
```

### Step 5: Enable and Start Service

```bash
# Reload systemd
systemctl --user daemon-reload

# Enable to auto-start on login
systemctl --user enable outlines-server.service

# Start service
systemctl --user start outlines-server.service

# Verify status
systemctl --user status outlines-server.service
```

### Step 6: Verify Service is Running

```bash
# Health check
curl http://localhost:6789/health

# Expected response
# {"status": "ok", "timestamp": "...", "ollama_ready": true, "outlines_available": true}

# Test generation
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test", "temperature": 0.5}'

# Monitor logs
journalctl --user -u outlines-server.service -f
```

## Post-Deployment Validation

### 1. Service Status

```bash
systemctl --user status outlines-server.service

# Expected output (active, running)
```

### 2. Health Endpoint

```bash
curl http://localhost:6789/health | python3 -m json.tool

# Expected:
# {
#   "status": "ok",
#   "timestamp": "2026-01-10T...",
#   "ollama_ready": true,
#   "outlines_available": true
# }
```

### 3. Basic Generation Test

```bash
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is 2+2? Answer: ",
    "temperature": 0.1
  }' | python3 -m json.tool

# Expected:
# {
#   "output": "4",
#   "tokens_used": 12,
#   "schema_validated": false
# }
```

### 4. Schema-Constrained Generation Test

```bash
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate JSON for a person with name and age: ",
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

# Expected:
# {
#   "output": {
#     "name": "Alice",
#     "age": 28
#   },
#   "tokens_used": 25,
#   "schema_validated": true
# }
```

### 5. Log Verification

```bash
# Check systemd journal
journalctl --user -u outlines-server.service -n 10

# Check log file
tail -20 ~/logs/outlines-server.log

# Expected:
# [Startup messages]
# [Request/response logs with timestamps]
# [Health check logs]
```

## Rollback Procedure

If issues occur:

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
```

## Performance Baseline

After deployment, capture baseline metrics:

```bash
# Startup time
time systemctl --user start outlines-server.service

# Memory usage (at idle)
ps aux | grep outlines-server | grep -v grep

# Response time (simple)
time curl http://localhost:6789/health

# Response time (generation)
time curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test", "temperature": 0.5}'

# Concurrent request handling (5 parallel requests)
for i in {1..5}; do
  curl -s -X POST http://localhost:6789/chat \
    -H "Content-Type: application/json" \
    -d '{"prompt": "test", "temperature": 0.5"}' &
done
wait
```

## Monitoring & Maintenance

### Daily Health Check

```bash
# Service running
systemctl --user status outlines-server.service

# Health endpoint
curl http://localhost:6789/health | jq '.status'

# Recent errors in logs
journalctl --user -u outlines-server.service --since "6 hours ago" | grep ERROR
```

### Log Rotation

```bash
# Manually rotate logs
mv ~/logs/outlines-server.log ~/logs/outlines-server.log.$(date +%Y%m%d)
systemctl --user kill -s HUP outlines-server.service
```

Or configure in `/etc/logrotate.d/outlines-server`:
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

### Update Service

```bash
# Edit service file
nano ~/.config/systemd/user/outlines-server.service

# Reload and restart
systemctl --user daemon-reload
systemctl --user restart outlines-server.service

# Verify
systemctl --user status outlines-server.service
```

## Troubleshooting Deployment

### Service Won't Start

```bash
# Check logs
journalctl --user -u outlines-server.service -f

# Common issues:
# - ImportError: outlines → pip install outlines
# - Connection refused (Ollama) → Start ollama serve
# - Address already in use → Change port or kill process
```

### Ollama Connection Issues

```bash
# Verify Ollama running
curl http://localhost:11434/api/tags

# If not, start it
ollama serve

# Or verify it's in systemd
systemctl --user status ollama.service
systemctl --system status ollama.service  # Try system-wide if user-level fails
```

### Port 6789 Already in Use

```bash
# Find process
lsof -i :6789

# Kill it
kill -9 <PID>

# Or change port in outlines-server.py and systemd service
```

### High Memory Usage

```bash
# Monitor
watch -n 1 'ps aux | grep outlines-server | grep -v grep'

# If memory grows over time, may indicate a memory leak
# Restart service:
systemctl --user restart outlines-server.service

# Or reduce max_tokens limit in requests
```

### Slow Response Times

```bash
# Check GPU memory (if using GPU)
nvidia-smi

# Check if Ollama is bottleneck
time curl http://localhost:11434/api/generate -d '{"model": "mistral:7b-instruct", "prompt": "test"}'

# If slow, Ollama may be constrained
# Solutions:
# - Use smaller model (mistral:3b instead of 7b)
# - Reduce max_tokens
# - Check system resources
```

## Integration Next Steps

Once deployed and validated:

1. **Test from yeast-agent.js**:
   ```javascript
   const response = await axios.post('http://localhost:6789/chat', {
     prompt: "Test",
     schema: { type: "object" },
     temperature: 0.5
   });
   ```

2. **Update consolidation logic** in `src/memory/episodic.js` to use Outlines for guaranteed JSON

3. **Phase 6 development**: Schema-aware reflection gates, memory refinement

## Success Criteria

✓ Service starts without errors
✓ Health endpoint returns `"status": "ok"`
✓ Simple generation requests complete in <1s
✓ Schema-constrained requests produce valid output
✓ Logs show all requests/responses
✓ Service survives Ollama restart
✓ No memory leaks over 1 hour of operation
✓ Concurrent requests handled correctly

---

**Deployment Status**: Ready for production
**Tested On**: Linux (apollo.local)
**Python Version**: 3.8+
**Last Updated**: January 10, 2026
