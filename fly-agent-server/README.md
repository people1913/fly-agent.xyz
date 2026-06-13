# Fly GEO Agent Server

ERC-8183 Provider for GEO (Geographical Optimization) services on BSC Mainnet.

## Overview

Fly GEO Agent is a blockchain-based GEO optimization service provider that:
- Receives GEO optimization requests from local businesses via ERC-8183 protocol
- Generates comprehensive GEO diagnostic reports
- Supports multiple service packages from starter to enterprise

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  Fly GEO Agent   │────▶│   BSC Mainnet   │
│  (Business) │     │   (ERC-8183)    │     │  (Smart Contract)│
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │  GEO Report      │
                    │  Generation      │
                    └──────────────────┘
```

## Packages

| Package | Price | Description |
|---------|-------|-------------|
| starter | 9.9 USDT | GEO诊断尝鲜 - Basic diagnosis |
| basic | 59 USDT/月 | 基础GEO优化 - Monthly optimization |
| pro | 299 USDT/月 | 深度GEO代运营 - Deep optimization |
| enterprise | 999 USDT/月 | 全托管代运营 - Full托管 service |

## Quick Start

### 1. Install Dependencies

```bash
pip install bnbagent  # Install from local SDK
pip install fastapi uvicorn python-dotenv pydantic requests
```

### 2. Configure Environment

Edit `.env` file with your settings:

```bash
cp .env.example .env
# Edit .env with your RPC URL and private key
```

### 3. Start Server

```bash
# Using the startup script
python scripts/run_agent.py

# Or directly with uvicorn
python -m uvicorn src.service:app --host 0.0.0.0 --port 8003
```

### 4. Test Server

```bash
python scripts/test_agent.py
```

## API Endpoints

### ERC-8183 Endpoints (Production)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/erc8183/health` | GET | Health check |
| `/erc8183/negotiate` | POST | Service negotiation |
| `/erc8183/status` | GET | Agent status |
| `/erc8183/job/{id}` | GET | Job details |

### Direct Endpoints (Testing)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info |
| `/health` | GET | Health check |
| `/geo-diagnosis` | POST | Generate GEO report |
| `/geo-diagnosis-preview` | GET | Quick preview |
| `/packages` | GET | List all packages |
| `/packages/{type}` | GET | Package details |

### Example: Generate GEO Report

```bash
curl -X POST http://localhost:8003/geo-diagnosis \
  -H "Content-Type: application/json" \
  -d '{
    "store_name": "成都火锅旗舰店",
    "industry": "餐饮火锅",
    "address": "成都市锦江区春熙路123号",
    "package_type": "starter"
  }'
```

## Contract Configuration

| Contract | Address (BSC Mainnet) |
|----------|----------------------|
| Commerce | 0xea4daa3100a767e886fded867729ae7446476eba6 |
| Router | 0x51895229e12f9876011789b04f8698af06ccd6da |
| Policy | 0x9c01845705b3078aa2e8cff7520a6376fd766de5 |
| Registry | 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 |

## Network

- **Network**: BSC Mainnet (chain_id=56)
- **RPC**: https://bsc-dataseed.binance.org
- **Payment Token**: USDT (0x55d398326f99059fF775485246999027B3197955)
- **Paymaster**: https://bsc-megafuel.nodereal.io/ (gas-free)

## Development

### Project Structure

```
fly-agent-server/
├── .env                 # Environment configuration
├── src/
│   └── service.py       # Main service logic
├── scripts/
│   ├── run_agent.py     # Startup script
│   └── test_agent.py   # Test script
└── README.md
```

### Testing

```bash
# Run all tests
python scripts/test_agent.py

# Test specific endpoint
curl http://localhost:8003/health
```

## License

MIT
