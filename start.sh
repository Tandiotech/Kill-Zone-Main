#!/bin/bash
echo ""
echo "⚡ KILLZONE Gold Intelligence Dashboard"
echo "========================================"
echo ""
echo "Installing dependencies..."
npm install --silent 2>&1 | tail -3
echo ""
echo "Building app..."
npm run build --silent 2>&1 | tail -3
echo ""
echo "✅ Starting server..."
echo ""
echo "========================================="
echo "  Open Chrome and go to:"
echo "  👉  http://localhost:5000"
echo "========================================="
echo ""
echo "Press Ctrl+C to stop the server."
echo ""
NODE_ENV=production node dist/index.cjs
