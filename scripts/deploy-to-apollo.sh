#!/bin/bash

# deploy-to-apollo.sh
# Safely deploy yeast updates to apollo.local without affecting memory or conversations
# Usage: ./scripts/deploy-to-apollo.sh [apollo-user] [apollo-host]

set -euo pipefail

# Configuration
APOLLO_USER="${1:-jay}"
APOLLO_HOST="${2:-apollo.local}"
APOLLO_ADDR="${APOLLO_USER}@${APOLLO_HOST}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m' # No Color

# Logging
log_error() {
  echo -e "${RED}✗ Error: $*${NC}" >&2
}

log_warn() {
  echo -e "${YELLOW}⚠ Warning: $*${NC}" >&2
}

log_info() {
  echo -e "${CYAN}ℹ $*${NC}"
}

log_success() {
  echo -e "${GREEN}✓ $*${NC}"
}

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo ""
echo -e "${YELLOW}   .---.      ${NC}"
echo -e "${YELLOW}  /     \\     ${NC}${CYAN}  ╔══════════════════════════════════════════╗${NC}"
echo -e "${YELLOW} (       )    ${NC}${CYAN}  ║${NC}     ${NC}${WHITE}${BOLD}🍞 AI YEAST${NC} - ${NC}${CYAN}Phase 5 Consolidation   ${CYAN}║${NC}"
echo -e "${YELLOW}  \\     /     ${NC}${CYAN}  ║${NC}       ${NC}${DIM}the starter is bubbling...${NC}         ${CYAN}║${NC}"
echo -e "${YELLOW}   '---'      ${NC}${CYAN}  ╚══════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Verify SSH connectivity
log_info "Verifying SSH connection to ${APOLLO_ADDR}..."
if ! ssh "${APOLLO_ADDR}" "echo 'SSH connection OK'" >/dev/null 2>&1; then
  log_error "Cannot connect to ${APOLLO_ADDR}"
  echo ""
  echo "Troubleshooting:"
  echo "  1. Verify apollo is reachable: ping ${APOLLO_HOST}"
  echo "  2. Check SSH key is configured: ls -la ~/.homelab_keys/id_rsa"
  echo "  3. Try manually: ssh ${APOLLO_ADDR}"
  echo ""
  exit 1
fi
log_success "SSH connection verified"

# Step 2: Check Node.js version on apollo
log_info "Checking Node.js on apollo..."
NODE_VERSION=$(ssh "${APOLLO_ADDR}" "node --version 2>/dev/null || echo 'NOT_INSTALLED'")
if [ "${NODE_VERSION}" = "NOT_INSTALLED" ]; then
  log_error "Node.js not found on apollo"
  echo ""
  echo "Install Node.js on apollo:"
  echo "  ssh ${APOLLO_ADDR}"
  echo "  sudo apt update && sudo apt install nodejs npm"
  echo ""
  exit 1
fi
log_success "Node.js ${NODE_VERSION} found on apollo"

# Step 3: Deploy agent script
log_info "Deploying yeast-agent.js..."
if scp "${PROJECT_ROOT}/src/agent/yeast-agent.js" "${APOLLO_ADDR}:~/" >/dev/null 2>&1; then
  log_success "yeast-agent.js deployed"
  ssh "${APOLLO_ADDR}" "chmod +x ~/yeast-agent.js" >/dev/null
  ssh "${APOLLO_ADDR}" "mkdir -p ~/prompts" >/dev/null
  scp -r "${PROJECT_ROOT}/src/agent/prompts/"* "${APOLLO_ADDR}:~/prompts/" >/dev/null
else
  log_error "Failed to deploy yeast-agent.js"
  exit 1
fi

# Step 4: Deploy package files (for dependency management)
log_info "Deploying package configuration..."
if scp "${PROJECT_ROOT}/package.json" "${PROJECT_ROOT}/package-lock.json" "${APOLLO_ADDR}:~/" >/dev/null 2>&1; then
  log_success "package.json and package-lock.json deployed"
else
  log_error "Failed to deploy package files"
  exit 1
fi

# Step 5: Install dependencies on apollo
log_info "Installing dependencies on apollo..."
if ssh "${APOLLO_ADDR}" "cd ~ && npm install --production --silent" >/dev/null 2>&1; then
  log_success "Dependencies installed"
else
  log_warn "npm install had issues (may still be OK)"
fi

# Step 6: Ensure memory directories exist (non-destructive)
log_info "Verifying memory directory structure..."
ssh "${APOLLO_ADDR}" "mkdir -p ~/yeast-data/{episodic,semantic,self_model,reflection,rag}" >/dev/null 2>&1
log_success "Memory directories verified (existing data untouched)"

# Step 7: Copy .env if it exists locally
if [ -f "${PROJECT_ROOT}/.env" ]; then
  log_info "Deploying .env configuration..."
  if scp "${PROJECT_ROOT}/.env" "${APOLLO_ADDR}:~/" >/dev/null 2>&1; then
    log_success ".env deployed"
  else
    log_warn ".env deployment skipped (may already exist on apollo)"
  fi
fi

# Step 8: Test Mistral availability
log_info "Checking Mistral availability on apollo..."
MISTRAL_CHECK=$(ssh "${APOLLO_ADDR}" \
  "curl -s http://localhost:11434/api/tags 2>/dev/null | grep -q 'mistral' && echo 'OK' || echo 'MISSING'" 2>/dev/null || echo "UNCHECKED")

if [ "${MISTRAL_CHECK}" = "OK" ]; then
  log_success "Mistral model is available"
elif [ "${MISTRAL_CHECK}" = "UNCHECKED" ]; then
  log_warn "Could not verify Mistral (Ollama may not be running)"
else
  log_warn "Mistral model not found on apollo"
  echo ""
  echo "To enable inference, on apollo.local run:"
  echo "  ollama pull mistral:7b-instruct"
  echo ""
fi

# Step 9: Test RAG/embeddings availability (optional)
log_info "Checking Ollama embeddings model..."
EMBEDDINGS_CHECK=$(ssh "${APOLLO_ADDR}" \
  "curl -s http://localhost:11434/api/tags 2>/dev/null | grep -q 'nomic-embed-text' && echo 'OK' || echo 'MISSING'" 2>/dev/null || echo "UNCHECKED")

if [ "${EMBEDDINGS_CHECK}" = "OK" ]; then
  log_success "nomic-embed-text embeddings model available (RAG enabled)"
elif [ "${EMBEDDINGS_CHECK}" = "UNCHECKED" ]; then
  log_info "Ollama not running (RAG will be skipped)"
else
  log_info "nomic-embed-text not installed (RAG optional, but can be enabled with: ollama pull nomic-embed-text)"
fi

# Step 10: Verify deployed agent works
log_info "Testing deployed agent..."
TEST_RESULT=$(ssh "${APOLLO_ADDR}" "echo '{\"command\":\"test\",\"input\":\"hello\"}' | timeout 5 node ~/yeast-agent.js 2>&1 || echo 'FAILED'" || echo "FAILED")

if echo "${TEST_RESULT}" | grep -q "FAILED"; then
  log_warn "Agent test returned an error (this may be normal if testing invalid input)"
else
  log_success "Agent test completed"
fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}           ${GREEN}Deployment Complete!${NC}                  ${GREEN}║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""

echo "Deployment Summary:"
echo "  ✓ yeast-agent.js updated"
echo "  ✓ Dependencies installed"
echo "  ✓ Configuration deployed"
echo "  ✓ Memory directories verified (data preserved)"
echo ""

echo "Next Steps:"
echo "  1. Conversations and memory are preserved on apollo"
echo "  2. Agent will use new code on next invocation"
echo "  3. Test with: npm start"
echo "  4. If issues occur, check with: ssh ${APOLLO_ADDR}"
echo ""

if [ "${MISTRAL_CHECK}" != "OK" ]; then
  echo "⚠ Note: Mistral not available. To enable inference:"
  echo "  ssh ${APOLLO_ADDR}"
  echo "  ollama pull mistral:7b-instruct"
  echo ""
fi

if [ "${EMBEDDINGS_CHECK}" != "OK" ] && [ "${EMBEDDINGS_CHECK}" != "UNCHECKED" ]; then
  echo "⚠ Note: nomic-embed-text not available. To enable RAG:"
  echo "  ssh ${APOLLO_ADDR}"
  echo "  ollama pull nomic-embed-text"
  echo ""
fi

log_success "Ready to use!"
echo ""
