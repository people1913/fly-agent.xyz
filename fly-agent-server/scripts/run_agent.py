#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fly GEO Agent Server - Startup Script

This script starts the Fly GEO Agent ERC-8183 Provider Server.

Usage:
    python scripts/run_agent.py

Environment:
    All configuration is loaded from .env file in the project root.
"""

import os
import sys
import subprocess
from pathlib import Path

# Get the project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

# Set the environment file path
os.environ["ENV_FILE"] = ".env"

# Change to project root for relative imports
os.chdir(PROJECT_ROOT)


def check_dependencies():
    """Check if all required dependencies are installed."""
    required_packages = [
        "bnbagent",
        "fastapi",
        "uvicorn",
        "dotenv",
        "pydantic"
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
        except ImportError:
            missing.append(package)
    
    if missing:
        print(f"❌ Missing dependencies: {', '.join(missing)}")
        print("Please install with: pip install " + " ".join(missing))
        return False
    
    print("✅ All dependencies installed")
    return True


def check_env_file():
    """Check if .env file exists."""
    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        print(f"❌ .env file not found at {env_path}")
        print("Please create .env file with required configuration")
        return False
    
    print(f"✅ .env file found at {env_path}")
    return True


def check_wallet():
    """Check if wallet can be loaded from private key."""
    try:
        from dotenv import load_dotenv
        load_dotenv(PROJECT_ROOT / ".env")
        
        private_key = os.getenv("PRIVATE_KEY", "")
        if not private_key:
            print("❌ PRIVATE_KEY not found in .env")
            return False
        
        from bnbagent.wallets import Wallet
        wallet = Wallet.from_key(private_key)
        print(f"✅ Wallet loaded: {wallet.address}")
        return True
        
    except Exception as e:
        print(f"❌ Wallet check failed: {e}")
        return False


def start_server():
    """Start the Fly GEO Agent server."""
    print("\n" + "="*60)
    print("  Starting Fly GEO Agent Server...")
    print("="*60 + "\n")
    
    try:
        # Import the service module
        from service import app, PORT
        
        # Run with uvicorn
        import uvicorn
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=PORT,
            log_level="info"
        )
        
    except KeyboardInterrupt:
        print("\n\n👋 Server stopped by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Server failed to start: {e}")
        sys.exit(1)


def main():
    """Main entry point."""
    print("""
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║     🗺️  Fly GEO Agent (ERC-8183 Provider)              ║
║                                                          ║
║     GEO Optimization Service for Local Businesses        ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
    """)
    
    # Run checks
    if not check_dependencies():
        sys.exit(1)
    
    if not check_env_file():
        sys.exit(1)
    
    if not check_wallet():
        sys.exit(1)
    
    # Start the server
    start_server()


if __name__ == "__main__":
    main()
