#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fly GEO Agent - Test Script

This script tests the Fly GEO Agent server endpoints.
"""

import requests
import json
from typing import Optional

BASE_URL = "http://localhost:8003"


def test_health():
    """Test health check endpoint."""
    print("\n📡 Testing /health endpoint...")
    try:
        resp = requests.get(f"{BASE_URL}/health", timeout=10)
        assert resp.status_code == 200, f"Status code: {resp.status_code}"
        data = resp.json()
        assert data["status"] == "healthy", f"Status: {data['status']}"
        print(f"  ✅ Health check passed: {data}")
        return True
    except Exception as e:
        print(f"  ❌ Health check failed: {e}")
        return False


def test_packages():
    """Test packages listing endpoint."""
    print("\n📦 Testing /packages endpoint...")
    try:
        resp = requests.get(f"{BASE_URL}/packages", timeout=10)
        assert resp.status_code == 200, f"Status code: {resp.status_code}"
        data = resp.json()
        assert "packages" in data, "No packages found"
        assert "starter" in data["packages"], "starter package missing"
        print(f"  ✅ Packages loaded: {list(data['packages'].keys())}")
        return True
    except Exception as e:
        print(f"  ❌ Packages test failed: {e}")
        return False


def test_package_detail():
    """Test specific package endpoint."""
    print("\n📋 Testing /packages/starter endpoint...")
    try:
        resp = requests.get(f"{BASE_URL}/packages/starter", timeout=10)
        assert resp.status_code == 200, f"Status code: {resp.status_code}"
        data = resp.json()
        assert data["name"] == "GEO诊断尝鲜", f"Wrong name: {data['name']}"
        assert data["price"] == 9.9, f"Wrong price: {data['price']}"
        print(f"  ✅ Package detail: {data['name']} - {data['price']} USDT")
        return True
    except Exception as e:
        print(f"  ❌ Package detail test failed: {e}")
        return False


def test_geo_diagnosis():
    """Test GEO diagnosis endpoint."""
    print("\n🗺️ Testing /geo-diagnosis endpoint...")
    try:
        payload = {
            "store_name": "成都火锅旗舰店",
            "industry": "餐饮火锅",
            "address": "成都市锦江区春熙路123号",
            "contact": "028-12345678",
            "website": "https://example.com",
            "package_type": "starter"
        }
        resp = requests.post(f"{BASE_URL}/geo-diagnosis", json=payload, timeout=30)
        assert resp.status_code == 200, f"Status code: {resp.status_code}"
        data = resp.json()
        assert data["success"] == True, "Success should be True"
        assert "report" in data, "No report in response"
        assert "店铺信息" in data["report"], "Report incomplete"
        print(f"  ✅ GEO diagnosis passed: {data['package_type']} - {len(data['report'])} chars")
        return True
    except Exception as e:
        print(f"  ❌ GEO diagnosis test failed: {e}")
        return False


def test_geo_diagnosis_preview():
    """Test GEO diagnosis preview endpoint (GET)."""
    print("\n🔍 Testing /geo-diagnosis-preview endpoint...")
    try:
        resp = requests.get(
            f"{BASE_URL}/geo-diagnosis-preview",
            params={
                "store_name": "测试牙科诊所",
                "industry": "医疗",
                "address": "北京朝阳区",
                "package_type": "basic"
            },
            timeout=30
        )
        assert resp.status_code == 200, f"Status code: {resp.status_code}"
        data = resp.json()
        assert data["success"] == True, "Success should be True"
        assert "report" in data, "No report in response"
        print(f"  ✅ Preview test passed: {data['package_type']}")
        return True
    except Exception as e:
        print(f"  ❌ Preview test failed: {e}")
        return False


def test_erc8183_health():
    """Test ERC-8183 health endpoint."""
    print("\n🔗 Testing /erc8183/health endpoint...")
    try:
        resp = requests.get(f"{BASE_URL}/erc8183/health", timeout=10)
        # May return 200 or error depending on network status
        print(f"  Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            print(f"  ✅ ERC-8183 health: {data}")
            return True
        else:
            print(f"  ⚠️ ERC-8183 health returned: {resp.text[:200]}")
            return False
    except Exception as e:
        print(f"  ⚠️ ERC-8183 health test: {e}")
        return False


def test_all_packages():
    """Test all package types."""
    print("\n📊 Testing all package types...")
    package_types = ["starter", "basic", "pro", "enterprise"]
    results = []
    
    for pkg_type in package_types:
        try:
            resp = requests.get(
                f"{BASE_URL}/geo-diagnosis-preview",
                params={
                    "store_name": f"测试店铺-{pkg_type}",
                    "industry": "餐饮",
                    "address": "测试地址",
                    "package_type": pkg_type
                },
                timeout=30
            )
            if resp.status_code == 200:
                data = resp.json()
                report_len = len(data.get("report", ""))
                print(f"  ✅ {pkg_type}: {report_len} chars")
                results.append(True)
            else:
                print(f"  ❌ {pkg_type}: {resp.status_code}")
                results.append(False)
        except Exception as e:
            print(f"  ❌ {pkg_type}: {e}")
            results.append(False)
    
    return all(results)


def main():
    """Run all tests."""
    print("="*60)
    print("  Fly GEO Agent - Test Suite")
    print("="*60)
    
    # Check if server is running
    try:
        requests.get(f"{BASE_URL}/health", timeout=5)
    except requests.exceptions.ConnectionError:
        print(f"\n❌ Server not running at {BASE_URL}")
        print("Please start the server first:")
        print("  cd fly-agent-server")
        print("  python src/service.py")
        return False
    
    # Run tests
    tests = [
        ("Health Check", test_health),
        ("Packages List", test_packages),
        ("Package Detail", test_package_detail),
        ("GEO Diagnosis (POST)", test_geo_diagnosis),
        ("GEO Diagnosis Preview (GET)", test_geo_diagnosis_preview),
        ("ERC-8183 Health", test_erc8183_health),
        ("All Packages", test_all_packages),
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ {name} crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*60)
    print("  Test Summary")
    print("="*60)
    
    passed = sum(1 for _, r in results if r)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"  {status} - {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        return True
    else:
        print("\n⚠️ Some tests failed")
        return False


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
