import asyncio
import sys
from backend.services.agent_service import agent_service
from backend.services.tools import tool_registry
from backend.services.llm import llm_service

async def run_tests():
    print("Testing Antigravity Coding Agent Integration...")

    # 1. Agent Service direct status check
    status = agent_service.get_status()
    print("[OK] Agent Service Status:", status)
    assert "state" in status
    assert status["state"] in ["idle", "running", "completed", "error", "cancelled"]
    assert "active_tool" in status
    assert "files_modified" in status

    # 2. Agent Service models list
    models = await agent_service.list_models()
    print("[OK] Agent Service Models:", models)
    assert isinstance(models, list)
    assert len(models) > 0

    # 3. Tool Registry antigravity_control - status
    tool_status = await tool_registry.antigravity_control("status")
    print("[OK] Tool Antigravity Status:", tool_status)
    assert "agent" in tool_status.lower()

    # 4. Tool Registry antigravity_control - models
    tool_models = await tool_registry.antigravity_control("models")
    print("[OK] Tool Antigravity Models:", tool_models)
    assert "models" in tool_models.lower() or "available" in tool_models.lower() or "supports" in tool_models.lower()

    # 5. Tool Registry antigravity_control - cancel when idle
    tool_cancel = await tool_registry.antigravity_control("cancel")
    print("[OK] Tool Antigravity Cancel:", tool_cancel)
    assert "no agent" in tool_cancel.lower() or "no active" in tool_cancel.lower()

    # 6. Intent Detection - Status query
    intent_status = await llm_service.detect_and_execute_tool("What is the coding agent doing right now?")
    print("[OK] Intent Agent Status:", intent_status)
    assert intent_status is not None
    assert intent_status[0] == "antigravity_control"

    # 7. Intent Detection - Stop/Cancel query
    intent_cancel = await llm_service.detect_and_execute_tool("Stop the coding agent immediately")
    print("[OK] Intent Agent Cancel:", intent_cancel)
    assert intent_cancel is not None
    assert intent_cancel[0] == "antigravity_control"

    # 8. Intent Detection - Dispatch query (explicit)
    intent_dispatch = await llm_service.detect_and_execute_tool("Ask the coding agent to add a new unit test")
    print("[OK] Intent Agent Dispatch:", intent_dispatch)
    assert intent_dispatch is not None
    assert intent_dispatch[0] == "antigravity_control"
    assert "dispatched" in intent_dispatch[1].lower()

    # Cancel background task before next test
    await agent_service.cancel_task()

    # 9. Intent Detection - Direct Script / File creation query
    intent_direct = await llm_service.detect_and_execute_tool("create a python script in scratch called hello_sam.py that prints a greeting and calculates the 10th Fibonacci number")
    print("[OK] Intent Direct Script Creation:", intent_direct)
    assert intent_direct is not None
    assert intent_direct[0] == "antigravity_control"
    assert "dispatched" in intent_direct[1].lower()

    # Give a moment and verify status is tracked or cancelling cleanup
    await agent_service.cancel_task()

    # 10. Command execution test
    cmd_res = await agent_service.execute_command("python -c \"print('hello from agent command runner')\"")
    print("[OK] Agent Command Runner:", cmd_res)
    assert cmd_res["exit_code"] == 0
    assert "hello from agent command runner" in cmd_res["output"]

    # 11. Tool registry terminal command execution test
    tool_cmd_res = await tool_registry.execute_terminal_command("python -c \"print(42 * 2)\"")
    print("[OK] Tool Terminal Command Execution:", tool_cmd_res)
    assert "84" in tool_cmd_res
    assert "successfully" in tool_cmd_res

    # 12. Run it intent detection
    agent_service.status.suggested_command = "python -c \"print('executed suggested')\""
    intent_run = await llm_service.detect_and_execute_tool("run the script")
    print("[OK] Intent Run Script:", intent_run)
    assert intent_run is not None
    assert "executed suggested" in intent_run[1]

    # Verify no 'Antigravity' brand name in tool outputs
    assert "antigravity" not in tool_status.lower()

    print("[ALL OK] All Agent tests passed successfully!")

if __name__ == "__main__":
    asyncio.run(run_tests())
    sys.exit(0)
