import asyncio
import json
import os
import shutil
from typing import Any, Dict, List, Optional

class MCPClient:
    """Lightweight native Model Context Protocol (JSON-RPC 2.0 over stdio) Client."""
    def __init__(self, command: str, args: List[str], env: Optional[Dict[str, str]] = None):
        self.command = command
        self.args = args
        self.env = {**os.environ, **(env or {})}
        self.process: Optional[asyncio.subprocess.Process] = None
        self._req_id = 0
        self._pending_requests: Dict[int, asyncio.Future] = {}
        self._tools: List[Dict[str, Any]] = []
        self._is_initialized = False

    async def start(self) -> bool:
        """Start the MCP server process and perform initialization handshake."""
        # Verify executable exists
        executable = shutil.which(self.command) or self.command
        try:
            self.process = await asyncio.create_subprocess_exec(
                executable,
                *self.args,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self.env,
            )
            asyncio.create_task(self._listen_stdout())

            # 1. Initialize
            init_res = await self._send_request("initialize", {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "SamVoiceAssistant", "version": "1.0.0"}
            })

            # 2. Send initialized notification
            await self._send_notification("notifications/initialized", {})
            self._is_initialized = True

            # 3. Discover tools
            await self.refresh_tools()
            return True
        except Exception as e:
            print(f"Failed to start MCP server ({self.command}): {e}")
            return False

    async def refresh_tools(self) -> List[Dict[str, Any]]:
        """Fetch list of tools provided by the MCP server."""
        try:
            response = await self._send_request("tools/list", {})
            self._tools = response.get("tools", [])
            return self._tools
        except Exception as e:
            print(f"Error listing MCP tools: {e}")
            return []

    async def call_tool(self, name: str, arguments: Dict[str, Any]) -> str:
        """Invoke a tool on the MCP server."""
        try:
            response = await self._send_request("tools/call", {
                "name": name,
                "arguments": arguments
            })
            content_list = response.get("content", [])
            texts = []
            for item in content_list:
                if isinstance(item, dict) and item.get("type") == "text":
                    texts.append(item.get("text", ""))
                elif isinstance(item, str):
                    texts.append(item)
            return "\n".join(texts) if texts else json.dumps(response)
        except Exception as e:
            return f"MCP tool call error ({name}): {e}"

    async def _send_request(self, method: str, params: Any) -> Dict[str, Any]:
        self._req_id += 1
        req_id = self._req_id
        future = asyncio.get_event_loop().create_future()
        self._pending_requests[req_id] = future

        msg = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": method,
            "params": params
        }
        raw = json.dumps(msg) + "\n"
        if self.process and self.process.stdin:
            self.process.stdin.write(raw.encode("utf-8"))
            await self.process.stdin.drain()

        return await asyncio.wait_for(future, timeout=15.0)

    async def _send_notification(self, method: str, params: Any) -> None:
        msg = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }
        raw = json.dumps(msg) + "\n"
        if self.process and self.process.stdin:
            self.process.stdin.write(raw.encode("utf-8"))
            await self.process.stdin.drain()

    async def _listen_stdout(self):
        if not self.process or not self.process.stdout:
            return
        while True:
            line = await self.process.stdout.readline()
            if not line:
                break
            try:
                data = json.loads(line.decode("utf-8").strip())
                req_id = data.get("id")
                if req_id in self._pending_requests:
                    future = self._pending_requests.pop(req_id)
                    if "error" in data:
                        future.set_exception(Exception(data["error"]))
                    else:
                        future.set_result(data.get("result", {}))
            except Exception:
                pass

    def stop(self):
        if self.process:
            try:
                self.process.terminate()
            except Exception:
                pass
            self.process = None

class MCPManager:
    def __init__(self):
        self.clients: Dict[str, MCPClient] = {}

    async def register_server(self, name: str, command: str, args: List[str]) -> bool:
        if name in self.clients:
            self.clients[name].stop()
        client = MCPClient(command, args)
        success = await client.start()
        if success:
            self.clients[name] = client
        return success

    def get_all_tools(self) -> List[Dict[str, Any]]:
        all_tools = []
        for server_name, client in self.clients.items():
            for tool in client._tools:
                all_tools.append({
                    "server": server_name,
                    "name": f"mcp_{server_name}_{tool.get('name')}",
                    "original_name": tool.get("name"),
                    "description": tool.get("description", ""),
                    "inputSchema": tool.get("inputSchema", {})
                })
        return all_tools

    async def call_mcp_tool(self, tool_name: str, args: Dict[str, Any]) -> Optional[str]:
        for server_name, client in self.clients.items():
            prefix = f"mcp_{server_name}_"
            if tool_name.startswith(prefix):
                orig_name = tool_name[len(prefix):]
                return await client.call_tool(orig_name, args)
        return None

mcp_manager = MCPManager()
