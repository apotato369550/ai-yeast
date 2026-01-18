# Outlines Server: Quick Start Guide

## Files Created

| File | Purpose | Lines | Executable |
|------|---------|-------|------------|
| `outlines-server.py` | FastAPI wrapper for Outlines.dev | 368 | ✓ Yes |
| `outlines-server.service` | systemd service template for apollo | 40 | - |
| `OUTLINES_SERVER.md` | Complete documentation | 543 | - |
| `OUTLINES_INTEGRATION.md` | Phase 5/6 integration guide | 370 | - |

## Dependencies

**Required Python packages** (install on apollo):
```bash
pip install fastapi uvicorn outlines pydantic
```

**System requirements**:
- Python 3.8+
- Ollama running on localhost:11434
- Port 6789 available

## 30-Second Setup

### On apollo.local

```bash
# 1. Install dependencies
pip install fastapi uvicorn outlines pydantic

# 2. Create logs directory
mkdir -p ~/logs

# 3. Copy files (from local machine, or via deployment script)
# scp scripts/outlines-server.py jay@apollo.local:~/scripts/
# scp scripts/outlines-server.service jay@apollo.local:~/.config/systemd/user/

# 4. Enable service
systemctl --user daemon-reload
systemctl --user enable outlines-server.service
systemctl --user start outlines-server.service

# 5. Verify
curl http://localhost:6789/health
```

## API Examples

### Health Check
```bash
curl http://apollo.local:6789/health
```

### Free Generation
```bash
curl -X POST http://apollo.local:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "The future of AI is",
    "temperature": 0.8
  }'
```

### Schema-Constrained Generation
```bash
curl -X POST http://apollo.local:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate a person: ",
    "schema": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "age": {"type": "integer"}
      },
      "required": ["name", "age"]
    },
    "temperature": 0.3
  }'
```

## Key Features

✓ **Guaranteed Schema Compliance**: Output validated during generation (not post-hoc)
✓ **Model Pooling**: Single Ollama connection reused across requests
✓ **Health Checks**: Real-time status of Ollama and service
✓ **Graceful Degradation**: Operates in reduced mode if Ollama unavailable
✓ **Structured Logging**: All requests logged to stdout + `/home/jay/logs/outlines-server.log`
✓ **SIGTERM Handling**: Clean shutdown on systemd restart/stop

## Logs

**Real-time monitoring**:
```bash
journalctl --user -u outlines-server.service -f
```

**Log file**:
```bash
tail -f ~/logs/outlines-server.log
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ImportError: outlines` | `pip install outlines` |
| `Connection refused` (Ollama) | `ollama serve` (in another terminal) |
| Port 6789 already in use | `lsof -i :6789 && kill <PID>` |
| Server starts in "degraded mode" | Check Ollama is running and reachable |
| Slow responses | Reduce `max_tokens` or check GPU memory |

## Integration with ai-yeast

**Phase 5**: Testing and validation
**Phase 6**: Used for:
- Consolidated memory (episodic → semantic)
- Reflection gate automation
- Self-model updates
- Batch fermentation with schemas

## File Locations

**Local (development)**:
```
ai-yeast/
├── scripts/
│   ├── outlines-server.py          (Main service)
│   ├── outlines-server.service     (systemd unit)
│   ├── OUTLINES_SERVER.md          (Full docs)
│   ├── OUTLINES_INTEGRATION.md     (Phase 5/6 guide)
│   └── OUTLINES_QUICKSTART.md      (This file)
```

**On apollo (production)**:
```
~/ (jay's home)
├── scripts/
│   └── outlines-server.py          (Main service)
├── logs/
│   └── outlines-server.log         (Service logs)
└── .config/systemd/user/
    └── outlines-server.service     (systemd unit)
```

## Verifying Installation

```bash
# 1. Service status
systemctl --user status outlines-server.service

# 2. Health endpoint
curl http://localhost:6789/health | python3 -m json.tool

# 3. Test generation
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Test"}' | python3 -m json.tool

# 4. Check logs
journalctl --user -u outlines-server.service -n 20
```

## Performance Notes

- **Startup**: ~3-5s (model initialization)
- **Per-request**: 100-500ms (depends on prompt length and max_tokens)
- **Memory**: ~4-6GB (Mistral 7B)
- **Concurrency**: FastAPI handles multiple concurrent requests

## Next Steps

1. **Deploy to apollo**: Copy files and systemd service
2. **Test endpoints**: Verify health and basic generation
3. **Integrate with yeast-agent.js**: Use for consolidation and reflection gates
4. **Phase 6 roadmap**: Autonomous schema-guided memory refinement

---

For complete documentation, see `OUTLINES_SERVER.md` and `OUTLINES_INTEGRATION.md`.
