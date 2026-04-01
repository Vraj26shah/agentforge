#!/bin/bash

# AgentForge Demo Script
# Demonstrates the system with a sample request

set -e

echo "🎬 AgentForge Demo"
echo "=================="
echo ""

# Configuration
BACKEND_URL="http://localhost:8000"
DEMO_REQUEST="Demonstrate the agent orchestration system with a simple task"

# Check if backend is running
echo "🔍 Checking backend connectivity..."
if ! curl -s $BACKEND_URL/health > /dev/null; then
    echo "❌ Backend is not running. Start it with: docker-compose up"
    exit 1
fi

echo "✓ Backend is running"
echo ""

# Submit demo request
echo "📤 Submitting demo request..."
echo "Request: '$DEMO_REQUEST'"
echo ""

RESPONSE=$(curl -s -X POST $BACKEND_URL/api/jailbreak \
  -H "Content-Type: application/json" \
  -d "{
    \"user_request\": \"$DEMO_REQUEST\",
    \"context\": {
      \"demo\": true,
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
    }
  }")

echo "📨 Response:"
echo $RESPONSE | jq . 2>/dev/null || echo $RESPONSE

echo ""
echo "✅ Demo request submitted!"
echo ""
echo "Next steps:"
echo "1. Open http://localhost:5173 in your browser"
echo "2. Check the Dashboard tab to see the request"
echo "3. Monitor the Task Flow tab for execution progress"
echo "4. Check Agent Board to see agent activity"
echo "5. View Debug Log for system events"
echo ""
echo "Tip: Run 'docker-compose logs -f' in another terminal to see backend logs"
echo ""
