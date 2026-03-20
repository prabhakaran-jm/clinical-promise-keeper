#!/bin/bash
# Test script for local development
# Requires: server running on localhost:3000, GCP credentials configured

BASE_URL="http://localhost:3000"

# Test health check
echo "=== Health Check ==="
curl -s "$BASE_URL/health" | jq .

# Test MCP initialize (simplified - just verify server responds)
echo -e "\n=== MCP Server Info ==="
curl -s -X POST "$BASE_URL/mcp" \
  -H "Content-Type: application/json" \
  -H "X-FHIR-Server-URL: https://hapi.fhir.org/baseR4" \
  -H "X-FHIR-Access-Token: test-token" \
  -H "X-Patient-ID: test-patient-123" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "capabilities": {},
      "clientInfo": { "name": "test-client", "version": "1.0.0" }
    }
  }' | jq .

echo -e "\n=== Done ==="
