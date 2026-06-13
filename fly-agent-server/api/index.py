#!/usr/bin/env python3
"""Fly GEO Agent — Vercel Serverless API with streaming."""
import os, httpx, json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

app = FastAPI(title="Fly GEO Agent", version="1.1.0")
DK = os.getenv("DEEPSEEK_API_KEY", "")
DK_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
DK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
PROVIDER = "0x5460BeEd186E1b3786713AFf6eD71962C1CBE931"
PKGS = {"starter":{"name":"GEO诊断尝鲜","price":9.9},"basic":{"name":"基础GEO优化","price":59},"pro":{"name":"深度GEO代运营","price":299},"enterprise":{"name":"全托管代运营","price":999}}
SYS = "你是Fly GEO Agent，本地商家AI搜索可见性诊断专家。生成GEO诊断报告：Markdown格式，含店铺信息表、AI搜索可见性评分(1-10)、平台覆盖诊断、优化建议。针对行业和地区精准建议，每条可执行。中文专业易懂，禁Web3/链上/合约术语。结尾加：*本报告由 Fly GEO Agent 生成 | fly-agent.xyz*。套餐：starter=5条,basic=10条+计划,pro=15条+竞品,enterprise=20条+专人方案"

class Req(BaseModel):
    store_name:str; industry:str=""; address:str=""; contact:str=""; website:str=""; package_type:str="starter"

@app.get("/")
async def root():
    return {"service":"Fly GEO Agent","version":"1.1.0","provider":PROVIDER,"deepseek_configured":bool(DK)}

@app.get("/health")
async def health():
    return {"status":"healthy","agent":"fly-geo-agent","version":"1.1.0","provider":PROVIDER,"deepseek_configured":bool(DK),"timestamp":datetime.now().isoformat()}

@app.get("/packages")
async def pkgs():
    return {"packages":PKGS,"currency":"USDT","network":"BSC Mainnet"}

@app.get("/geo-diagnosis")
async def diag_get(store_name:str,industry:str="",address:str="",contact:str="",website:str="",package_type:str="starter"):
    if not DK: raise HTTPException(503,"DeepSeek not configured")
    prompt=f"店铺：{store_name}|行业：{industry}|地址：{address}|联系：{contact}|网站：{website}|套餐：{package_type}|时间：{datetime.now().strftime('%Y%m%d %H:%M')}"
    async with httpx.AsyncClient(timeout=55) as c:
        r=await c.post(f"{DK_URL}/chat/completions",headers={"Authorization":f"Bearer {DK}"},json={"model":DK_MODEL,"messages":[{"role":"system","content":SYS},{"role":"user","content":prompt}],"max_tokens":3000,"temperature":0.7})
        r.raise_for_status()
    return {"success":True,"package_type":package_type,"store_name":store_name,"report":r.json()["choices"][0]["message"]["content"],"metadata":{"agent":"fly-geo-agent","generated_at":datetime.now().isoformat(),"provider":PROVIDER}}

@app.post("/geo-diagnosis")
async def diag_post(req:Req):
    if not DK: raise HTTPException(503,"DeepSeek not configured")
    prompt=f"店铺：{req.store_name}|行业：{req.industry}|地址：{req.address}|联系：{req.contact}|网站：{req.website}|套餐：{req.package_type}|时间：{datetime.now().strftime('%Y%m%d %H:%M')}"
    async def gen():
        yield f"data: {json.dumps({'type':'meta','store_name':req.store_name,'package_type':req.package_type},ensure_ascii=False)}\n\n"
        try:
            async with httpx.AsyncClient(timeout=55) as c:
                async with c.stream("POST",f"{DK_URL}/chat/completions",headers={"Authorization":f"Bearer {DK}"},json={"model":DK_MODEL,"messages":[{"role":"system","content":SYS},{"role":"user","content":prompt}],"max_tokens":3000,"temperature":0.7,"stream":True}) as r:
                    r.raise_for_status(); full=""
                    async for line in r.aiter_lines():
                        if line.startswith("data: ") and line!="data: [DONE]":
                            try:
                                d=json.loads(line[6:]);ct=d.get("choices",[{}])[0].get("delta",{}).get("content","")
                                if ct: full+=ct; yield f"data: {json.dumps({'type':'chunk','content':ct},ensure_ascii=False)}\n\n"
                            except: pass
                    yield f"data: {json.dumps({'type':'done','report':full,'generated_at':datetime.now().isoformat()},ensure_ascii=False)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type':'error','message':str(e)},ensure_ascii=False)}\n\n"
    return StreamingResponse(gen(),media_type="text/event-stream",headers={"Cache-Control":"no-cache","X-Accel-Buffering":"no"})

class ChatReq(BaseModel):
    messages: list = []
    model: str = "deepseek-chat"
    max_tokens: int = 300
    temperature: float = 0.7

@app.post("/chat")
async def chat_proxy(req: ChatReq):
    """Chat proxy - front-end calls this instead of DeepSeek directly."""
    if not DK:
        raise HTTPException(503, "DeepSeek not configured on server")
    
    SYS_PROMPT = """你是Fly的AI员工，专门帮小老板诊断推广盲区、优化营销。规则：
1. 像真人聊天，不念稿不列清单不用模板
2. 每次只说1-2个要点，说完追问
3. 用户说不清楚时追问（什么店？在哪？月推广费？投了哪些平台？）
4. 记住上下文不重复问
5. 说话像朋友不像客服
6. 先理解再建议，不甩方案
7. 用人话解释专业概念
8. 回复100字内
用中文回复。"""
    
    messages = [{"role": "system", "content": SYS_PROMPT}] + req.messages[-10:]
    
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(
            f"{DK_URL}/chat/completions",
            headers={"Authorization": f"Bearer {DK}"},
            json={
                "model": req.model,
                "messages": messages,
                "max_tokens": req.max_tokens,
                "temperature": req.temperature
            }
        )
        r.raise_for_status()
    
    data = r.json()
    if data.get("choices") and data["choices"][0]:
        return {"success": True, "reply": data["choices"][0]["message"]["content"]}
    raise HTTPException(500, "Invalid response from DeepSeek")
