#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Market Lens Development Setup     ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if node_modules exists in server directory
if [ ! -d "server/node_modules" ]; then
    echo -e "${YELLOW}📦 Installing API server dependencies...${NC}"
    cd server
    npm install
    cd ..
    echo -e "${GREEN}✓ API server dependencies installed${NC}"
    echo ""
fi

# Check if node_modules exists in root directory
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
    npm install
    echo -e "${GREEN}✓ Frontend dependencies installed${NC}"
    echo ""
fi

echo -e "${GREEN}🚀 Starting Market Lens...${NC}"
echo ""
echo -e "${BLUE}Starting API Server on port 3001...${NC}"
echo -e "${BLUE}Starting Frontend on port 3000...${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down servers...${NC}"
    kill $API_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start API server in background
cd server
npm start &
API_PID=$!
cd ..

# Wait a bit for API server to start
sleep 2

# Start frontend in background
npm run dev &
FRONTEND_PID=$!

# Wait for both processes
wait
