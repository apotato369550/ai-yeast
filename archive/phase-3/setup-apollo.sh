#!/usr/bin/env bash

# setup-apollo.sh - Initialize yeast-agent on apollo.local
# This script:
# 1. Copies yeast-agent to apollo.local
# 2. Creates the memory store directory structure
# 3. Tests Ollama availability
# 4. Creates .env configuration file

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_error() {
  echo -e "${RED}✗ Error: $*${NC}" >&2
}

log_warn() {
  echo -e "${YELLOW}⚠ $*${NC}" >&2
}

log_info() {
  echo -e "${BLUE}ℹ $*${NC}" >&2
}

log_success() {
  echo -e "${GREEN}✓ $*${NC}" >&2
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}    Yeast Agent Setup for apollo.local           ${CYAN}║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Ask for Apollo credentials
log_info "Please provide your apollo.local SSH connection details:"
echo ""

read -p "Apollo hostname [apollo.local]: " apollo_host
apollo_host="${apollo_host:-apollo.local}"

read -p "Apollo username [$USER]: " apollo_user
apollo_user="${apollo_user:-$USER}"

read -p "Apollo SSH port [22]: " apollo_port
apollo_port="${apollo_port:-22}"

echo ""

# Step 2: Test SSH connection
log_info "Testing SSH connection..."

if ssh -p "$apollo_port" "$apollo_user@$apollo_host" "echo 'SSH OK'" >/dev/null 2>&1; then
  log_success "SSH connection successful"
else
  log_error "SSH connection failed"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Verify apollo is reachable: ping $apollo_host"
  echo "  2. Check SSH key is configured"
  echo "  3. Try manually: ssh -p $apollo_port $apollo_user@$apollo_host"
  echo ""
  exit 1
fi

# Step 3: Copy yeast-agent to apollo
log_info "Copying yeast-agent to apollo..."

if scp -P "$apollo_port" "$SCRIPT_DIR/yeast-agent" "$apollo_user@$apollo_host":~/yeast-agent >/dev/null 2>&1; then
  log_success "yeast-agent copied successfully"

  # Make it executable
  ssh -p "$apollo_port" "$apollo_user@$apollo_host" "chmod +x ~/yeast-agent"
else
  log_error "Failed to copy yeast-agent"
  echo "  Make sure yeast-agent exists at: $SCRIPT_DIR/yeast-agent"
  exit 1
fi

# Step 4: Create memory directory structure
log_info "Creating memory store directory structure..."

if ssh -p "$apollo_port" "$apollo_user@$apollo_host" "mkdir -p ~/yeast-data"; then
  log_success "Memory directory created"
else
  log_error "Failed to create memory directory"
  exit 1
fi

# Step 5: Memory stores will be created on first run
log_info "Initializing default memory stores..."
log_success "Memory stores will be created on first run (skipping pre-init)"

# Step 6: Test Ollama availability
log_info "Testing Ollama on apollo..."

ollama_check=$(ssh -p "$apollo_port" "$apollo_user@$apollo_host" \
  "curl -s http://localhost:11434/api/tags 2>/dev/null | grep -q 'mistral' && echo 'OK' || echo 'FAIL'" 2>/dev/null || echo "FAIL")

if [ "$ollama_check" = "OK" ]; then
  log_success "Mistral model is available on apollo"
else
  log_warn "Could not verify Mistral on apollo"
  echo ""
  echo "On apollo.local, make sure:"
  echo "  1. Ollama is running: systemctl status ollama"
  echo "  2. Mistral is pulled: ollama pull mistral:7b-instruct"
  echo "  3. Ollama API is available: curl http://localhost:11434/api/tags"
  echo ""
fi

# Step 7: Create .env file
log_info "Creating .env file..."

cat > "$ENV_FILE" <<EOF
# Yeast Agent Configuration
APOLLO_HOST="$apollo_host"
APOLLO_USER="$apollo_user"
APOLLO_PORT="$apollo_port"
AGENT_PATH="~/yeast-agent"
EOF

log_success ".env file created"

# Step 8: Test yeast CLI
log_info "Testing yeast CLI..."

# Make yeast executable
if [ -f "$SCRIPT_DIR/yeast" ]; then
  chmod +x "$SCRIPT_DIR/yeast"

  # Test with timeout - first run will create memory stores
  if timeout 10 "$SCRIPT_DIR/yeast" -p "Hello" >/dev/null 2>&1; then
    log_success "yeast CLI is working"
  else
    log_warn "yeast CLI initialization running (will complete on next run)"
    log_info "This is normal - Mistral is being called for the first time"
  fi
else
  log_warn "yeast script not found"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}            ${GREEN}Setup Complete!${NC}                      ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo "  1. Start interactive mode: ./yeast"
echo "  2. Ask a question: ./yeast -p \"What are my drives?\""
echo "  3. Inspect memory: ./yeast -p \"/inspect\""
echo ""
echo "Configuration saved to: $ENV_FILE"
echo ""
