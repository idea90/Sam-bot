import asyncio
import json
from typing import Optional
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ..services.agent_service import agent_service

router = APIRouter(prefix="/api/agent", tags=["Antigravity Coding Agent"])

class DispatchAgentRequest(BaseModel):
    instruction: str
    model: Optional[str] = None
    workspace: Optional[str] = None

@router.get("/status")
async def get_agent_status():
    """Return real-time telemetry and status of the Antigravity coding agent."""
    return agent_service.get_status()

@router.get("/models")
async def get_agent_models():
    """Return list of available Antigravity models."""
    models = await agent_service.list_models()
    return {"models": models}

@router.post("/cancel")
async def cancel_agent_task():
    """Cancel the actively running Antigravity coding task."""
    cancelled = await agent_service.cancel_task()
    return {"cancelled": cancelled, "status": agent_service.get_status()}

@router.post("/dispatch")
async def dispatch_agent_task(req: DispatchAgentRequest):
    """Dispatch a coding instruction to Antigravity and stream NDJSON progress."""
    if not req.instruction.strip():
        raise HTTPException(status_code=400, detail="Instruction cannot be empty")

    if agent_service.status.state == "running":
        raise HTTPException(status_code=409, detail="An agent task is already in progress")

    async def event_generator():
        try:
            async for evt in agent_service.dispatch_task(
                instruction=req.instruction,
                model=req.model,
                workspace=req.workspace,
            ):
                yield json.dumps(evt, ensure_ascii=False) + "\n"
        except Exception as e:
            yield json.dumps({"event": "error", "message": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@router.websocket("/ws")
async def agent_websocket(websocket: WebSocket):
    """WebSocket endpoint pushing live agent events to connected clients."""
    await websocket.accept()
    queue = agent_service.subscribe()

    # Send current status immediately upon connection
    await websocket.send_json({"event": "status", "data": agent_service.get_status()})

    try:
        while True:
            # We listen for both incoming events from agent_service and client pings
            event_task = asyncio.create_task(queue.get())
            recv_task = asyncio.create_task(websocket.receive_text())

            done, pending = await asyncio.wait(
                [event_task, recv_task],
                return_when=asyncio.FIRST_COMPLETED
            )

            for task in pending:
                task.cancel()

            if recv_task in done:
                client_msg = recv_task.result()
                try:
                    payload = json.loads(client_msg)
                    msg_type = payload.get("type")
                    if msg_type == "ping":
                        await websocket.send_json({"type": "pong"})
                    elif msg_type == "dispatch":
                        inst = payload.get("instruction", "")
                        mod = payload.get("model")
                        if inst and agent_service.status.state != "running":
                            # Dispatch in background task
                            asyncio.create_task(self_consume(agent_service.dispatch_task(inst, mod)))
                    elif msg_type == "cancel":
                        await agent_service.cancel_task()
                except Exception:
                    pass

            if event_task in done:
                event_data = event_task.result()
                await websocket.send_json(event_data)

    except WebSocketDisconnect:
        pass
    finally:
        agent_service.unsubscribe(queue)

class RunCommandRequest(BaseModel):
    command: str

@router.post("/run-command")
async def run_agent_command(req: RunCommandRequest):
    """Execute a shell command in the project workspace."""
    if not req.command.strip():
        raise HTTPException(status_code=400, detail="Command cannot be empty")
    return await agent_service.execute_command(req.command)

async def self_consume(gen):
    """Consume an async generator to trigger dispatch without blocking the caller."""
    try:
        async for _ in gen:
            pass
    except Exception as e:
        print(f"Agent background task consumption error: {e}")
