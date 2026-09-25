import asyncio
import json
import os
import re
import shutil
import subprocess
import time
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Any, AsyncGenerator, Dict, List, Optional, Set

@dataclass
class AgentStatus:
    state: str = "idle"  # "idle" | "running" | "completed" | "error" | "cancelled"
    current_task: Optional[str] = None
    conversation_id: Optional[str] = None
    active_tool: Optional[str] = None
    active_tool_summary: Optional[str] = None
    files_modified: List[str] = field(default_factory=list)
    suggested_command: Optional[str] = None
    workspace_path: str = ""
    latest_output: str = ""
    start_time: Optional[float] = None
    duration_seconds: float = 0.0
    error: Optional[str] = None
    model: str = "gemini-2.5-flash"
    engine: str = "hermes"  # "hermes" | "coding_agent"
    available_engines: List[Dict[str, Any]] = field(default_factory=list)
    skills: List[Dict[str, str]] = field(default_factory=list)

class AgentService:
    def __init__(self, workspace_path: Optional[str] = None):
        # Default workspace is the Sam-bot project root
        self.workspace_path = workspace_path or str(Path(__file__).resolve().parents[4])
        self.hermes_path = self._find_hermes_binary()
        self.agy_path = self._find_agy_binary()

        # Default to Hermes Agent if installed, otherwise fallback to Coding Agent
        default_engine = "hermes" if self.hermes_path else "coding_agent"
        default_model = "gemini-2.5-flash" if default_engine == "hermes" else "gemini-3.8-flash-high"

        self.status = AgentStatus(
            workspace_path=self.workspace_path,
            engine=default_engine,
            model=default_model,
        )
        # Ensure workspace scratch directory exists
        try:
            (Path(self.workspace_path) / "scratch").mkdir(parents=True, exist_ok=True)
        except Exception:
            pass
        self._current_process: Optional[asyncio.subprocess.Process] = None
        self._subscribers: Set[asyncio.Queue] = set()
        self._cached_models: Optional[List[Dict[str, str]]] = None
        self._cached_skills: Optional[List[Dict[str, str]]] = None
        self._active_async_task: Optional[asyncio.Task] = None

    def _find_hermes_binary(self) -> Optional[str]:
        """Find the path to hermes.cmd or hermes binary on the host system."""
        in_path = shutil.which("hermes.cmd") or shutil.which("hermes")
        if in_path:
            return in_path

        local_app_data = os.environ.get("LOCALAPPDATA", "")
        if local_app_data:
            candidate = Path(local_app_data) / "hermes" / "bin" / "hermes.cmd"
            if candidate.is_file():
                return str(candidate)

        user_profile = os.environ.get("USERPROFILE", "")
        if user_profile:
            candidate2 = Path(user_profile) / ".hermes" / "bin" / "hermes.cmd"
            if candidate2.is_file():
                return str(candidate2)
            candidate3 = Path(user_profile) / "AppData" / "Local" / "hermes" / "bin" / "hermes.cmd"
            if candidate3.is_file():
                return str(candidate3)

        return None

    def _find_agy_binary(self) -> str:
        """Find the path to agy.exe on the host system."""
        # 1. System PATH
        in_path = shutil.which("agy") or shutil.which("agy.exe")
        if in_path:
            return in_path

        # 2. Standard Windows install locations
        local_app_data = os.environ.get("LOCALAPPDATA", "")
        if local_app_data:
            candidate = Path(local_app_data) / "agy" / "bin" / "agy.exe"
            if candidate.is_file():
                return str(candidate)

        user_profile = os.environ.get("USERPROFILE", "")
        if user_profile:
            candidate2 = Path(user_profile) / ".gemini" / "bin" / "agy.exe"
            if candidate2.is_file():
                return str(candidate2)

        return "agy.exe"

    def get_status(self) -> Dict[str, Any]:
        """Return the current agent execution status."""
        data = asdict(self.status)
        if self.status.state == "running" and self.status.start_time:
            data["duration_seconds"] = round(time.time() - self.status.start_time, 1)

        data["available_engines"] = [
            {
                "id": "hermes",
                "name": "Hermes Agent (Nous)",
                "available": bool(self.hermes_path),
                "description": "Nous Research autonomous agent with 51+ skills and tool calling"
            },
            {
                "id": "coding_agent",
                "name": "Coding Agent",
                "available": bool(self.agy_path and self.agy_path != "agy.exe"),
                "description": "Standard terminal coding assistant"
            },
        ]
        return data

    def set_engine(self, engine: str) -> Dict[str, Any]:
        """Switch active agent engine between 'hermes' and 'coding_agent'."""
        clean = (engine or "").lower().strip()
        if clean in ["hermes", "nous", "hermes_agent"]:
            self.status.engine = "hermes"
            self.status.model = "gemini-2.5-flash"
        elif clean in ["coding_agent", "agy", "antigravity", "default"]:
            self.status.engine = "coding_agent"
            self.status.model = "gemini-3.8-flash-high"
        self._cached_models = None
        return self.get_status()

    def subscribe(self) -> asyncio.Queue:
        """Subscribe to real-time agent event broadcasts."""
        q: asyncio.Queue = asyncio.Queue()
        self._subscribers.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        """Unsubscribe from event broadcasts."""
        self._subscribers.discard(q)

    async def _broadcast(self, event: Dict[str, Any]) -> None:
        """Broadcast an event to all active WebSocket subscribers."""
        for q in list(self._subscribers):
            try:
                q.put_nowait(event)
            except Exception:
                self._subscribers.discard(q)

    async def list_models(self) -> List[Dict[str, str]]:
        """List available models for the currently selected engine."""
        if self._cached_models:
            return self._cached_models

        if self.status.engine == "hermes":
            models = [
                {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash (Hermes)"},
                {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro (Hermes)"},
                {"id": "copilot/gpt-4o", "name": "GitHub Copilot (GPT-4o)"},
                {"id": "copilot/claude-3.5-sonnet", "name": "GitHub Copilot (Claude 3.5 Sonnet)"},
                {"id": "anthropic/claude-sonnet-4", "name": "Claude Sonnet 4 (Hermes)"},
                {"id": "nous/hermes-3-llama-3.1-70b", "name": "Hermes 3 70B (Nous)"},
                {"id": "local", "name": "Local Model (Hermes LLaMA)"},
            ]
            self._cached_models = models
            return models

        # Coding Agent models
        try:
            proc = await asyncio.create_subprocess_exec(
                self.agy_path, "models",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await proc.communicate()
            output = stdout.decode("utf-8", errors="replace")

            models: List[Dict[str, str]] = []
            for line in output.splitlines():
                line = line.strip()
                if not line or line.startswith("Fetching"):
                    continue
                parts = line.split("\t")
                if len(parts) >= 2:
                    models.append({"id": parts[0].strip(), "name": parts[1].strip()})
                elif len(parts) == 1:
                    models.append({"id": parts[0].strip(), "name": parts[0].strip()})

            if models:
                self._cached_models = models
                return models
        except Exception as e:
            print(f"Error querying agy models: {e}")

        # Fallback default models
        fallback = [
            {"id": "gemini-3.8-flash-high", "name": "Gemini 3.8 Flash (High)"},
            {"id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6 (Thinking)"},
            {"id": "claude-opus-4-6-thinking", "name": "Claude Opus 4.6 (Thinking)"},
            {"id": "gemini-3.6-flash-high", "name": "Gemini 3.6 Flash (High)"},
        ]
        self._cached_models = fallback
        return fallback

    async def list_skills(self) -> List[Dict[str, str]]:
        """List skills installed in Hermes Agent."""
        if self._cached_skills:
            return self._cached_skills

        if not self.hermes_path:
            return []

        try:
            proc = await asyncio.create_subprocess_exec(
                self.hermes_path, "skills", "list",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await proc.communicate()
            output = stdout.decode("utf-8", errors="replace")
            skills: List[Dict[str, str]] = []
            for line in output.splitlines():
                if "│" in line and not line.startswith("┌") and not line.startswith("└") and not line.startswith("├"):
                    parts = [p.strip() for p in line.split("│") if p.strip()]
                    if len(parts) >= 3 and parts[0].lower() != "name":
                        skills.append({
                            "name": parts[0],
                            "category": parts[1] if len(parts) > 1 else "general",
                            "status": parts[4] if len(parts) > 4 else "enabled"
                        })
            if skills:
                self._cached_skills = skills
                self.status.skills = skills
                return skills
        except Exception as e:
            print(f"Error listing hermes skills: {e}")

        return self.status.skills or []

    async def dispatch_task(
        self,
        instruction: str,
        model: Optional[str] = None,
        workspace: Optional[str] = None,
        engine: Optional[str] = None,
        skills: Optional[List[str]] = None,
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Dispatch a task to Hermes Agent or Coding Agent and stream live events."""
        target_workspace = workspace or self.workspace_path
        target_engine = engine or self.status.engine or ("hermes" if self.hermes_path else "coding_agent")
        target_model = model or self.status.model

        if target_engine == "hermes" and not target_model:
            target_model = "gemini-2.5-flash"
        elif target_engine != "hermes" and not target_model:
            target_model = "gemini-3.8-flash-high"

        if self.status.state == "running":
            yield {
                "event": "error",
                "message": f"An agent task is already running: '{self.status.current_task}'"
            }
            return

        # Initialize running state
        self.status = AgentStatus(
            state="running",
            current_task=instruction,
            start_time=time.time(),
            model=target_model,
            workspace_path=target_workspace,
            engine=target_engine,
        )

        start_event = {
            "event": "start",
            "instruction": instruction,
            "workspace": target_workspace,
            "model": target_model,
            "engine": target_engine,
            "timestamp": time.time(),
        }
        await self._broadcast(start_event)
        yield start_event

        # Ensure workspace scratch directory exists
        try:
            (Path(target_workspace) / "scratch").mkdir(parents=True, exist_ok=True)
        except Exception:
            pass

        # Build command based on selected engine
        if target_engine == "hermes" and self.hermes_path:
            cmd = [
                self.hermes_path,
                "chat",
                "-q", instruction,
                "--format", "stream-json",
                "--yolo",
                "--in", target_workspace,
            ]
            if target_model:
                if "/" in target_model:
                    prov, mod = target_model.split("/", 1)
                    cmd.extend(["--provider", prov, "-m", mod])
                elif target_model == "local":
                    pass
                else:
                    cmd.extend(["--provider", "gemini", "-m", target_model])
            else:
                cmd.extend(["--provider", "gemini", "-m", "gemini-2.5-flash"])

            if skills:
                cmd.extend(["-s", ",".join(skills)])
        else:
            # Coding Agent (agy)
            cmd = [
                self.agy_path,
                "-p", instruction,
                "--add-dir", target_workspace,
                "--output-format", "stream-json",
                "--dangerously-skip-permissions",
                "--model", target_model or "gemini-3.8-flash-high",
            ]

        try:
            self._current_process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=target_workspace,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            assert self._current_process.stdout is not None
            full_response = ""
            modified_files_set: Set[str] = set()

            while True:
                line_bytes = await self._current_process.stdout.readline()
                if not line_bytes:
                    break
                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                try:
                    data = json.loads(line)

                    # Check for Hermes Agent Event Schema
                    h_type = data.get("type")
                    if h_type:
                        if h_type == "system":
                            sub = data.get("subtype")
                            if sub == "init":
                                sess_id = data.get("session_id")
                                self.status.conversation_id = sess_id
                                mod = data.get("model")
                                if mod:
                                    self.status.model = mod
                                init_evt = {"event": "init", "conversation_id": sess_id, "model": self.status.model}
                                await self._broadcast(init_evt)
                                yield init_evt

                        elif h_type == "tool_use":
                            tool_name = data.get("name", "tool")
                            tool_inp = data.get("input", {})
                            self.status.active_tool = tool_name

                            # Derive descriptive summary
                            if tool_name == "write_file":
                                target_p = tool_inp.get("path", "")
                                self.status.active_tool_summary = f"Writing {Path(target_p).name}" if target_p else "Writing file"
                                if target_p:
                                    modified_files_set.add(str(target_p).replace("\\", "/"))
                                    self.status.files_modified = list(modified_files_set)
                            elif tool_name == "terminal":
                                cmd_snippet = (tool_inp.get("command") or "")[:40]
                                self.status.active_tool_summary = f"Running: {cmd_snippet}"
                            else:
                                self.status.active_tool_summary = f"Executing {tool_name}"

                            step_evt = {
                                "event": "step_update",
                                "step_update": {
                                    "step_type": "tool",
                                    "tool_name": tool_name,
                                    "tool_info": {"parameters": tool_inp, "name": tool_name}
                                }
                            }
                            await self._broadcast(step_evt)
                            yield step_evt

                        elif h_type == "tool_result":
                            out_str = data.get("output", "")
                            if isinstance(out_str, str):
                                try:
                                    parsed_out = json.loads(out_str)
                                    for fm in parsed_out.get("files_modified", []):
                                        modified_files_set.add(str(fm).replace("\\", "/"))
                                    self.status.files_modified = list(modified_files_set)
                                except Exception:
                                    pass

                            res_evt = {
                                "event": "step_update",
                                "step_update": {
                                    "step_type": "tool_result",
                                    "output": str(out_str)[:300]
                                }
                            }
                            await self._broadcast(res_evt)
                            yield res_evt

                        elif h_type == "text":
                            delta = data.get("text", "")
                            if delta:
                                full_response += delta
                                self.status.latest_output = full_response
                                delta_evt = {
                                    "event": "step_update",
                                    "step_update": {
                                        "step_type": "agent_response",
                                        "text_delta": delta
                                    }
                                }
                                await self._broadcast(delta_evt)
                                yield delta_evt

                        elif h_type == "result":
                            exit_code = data.get("exit_code", 0)
                            dur_ms = data.get("duration_ms", 0)
                            dur = round((dur_ms / 1000.0) if dur_ms else (time.time() - (self.status.start_time or 0)), 1)
                            resp_text = data.get("text", full_response)

                            self.status.state = "completed" if exit_code == 0 else "error"
                            self.status.duration_seconds = dur
                            self.status.latest_output = resp_text
                            self.status.active_tool = None
                            self.status.active_tool_summary = None

                            res_evt = {
                                "event": "result",
                                "result": {
                                    "status": "SUCCESS" if exit_code == 0 else "ERROR",
                                    "response": resp_text,
                                    "duration_seconds": dur,
                                }
                            }
                            await self._broadcast(res_evt)
                            yield res_evt

                        continue

                    # Coding Agent (agy) Event Schema
                    evt_type = data.get("event")

                    # 1. Initialization event
                    if evt_type == "init":
                        conv_id = data.get("conversation_id")
                        self.status.conversation_id = conv_id
                        await self._broadcast(data)
                        yield data

                    # 2. Step updates (tool calls, text deltas)
                    elif evt_type == "step_update":
                        su = data.get("step_update", {})
                        step_type = su.get("step_type")

                        # Inspect text deltas
                        delta = su.get("text_delta", "")
                        if delta:
                            full_response += delta
                            self.status.latest_output = full_response

                        # Inspect tool execution
                        tool_info = su.get("tool_info", {})
                        tool_name = (
                            su.get("tool_name")
                            or (tool_info.get("name") if isinstance(tool_info, dict) else None)
                            or su.get("tool_call")
                            or su.get("tool")
                        )
                        if isinstance(tool_name, dict):
                            tool_name = tool_name.get("name", "")

                        if tool_name:
                            self.status.active_tool = str(tool_name)
                            summary = su.get("tool_summary")
                            if not summary and isinstance(tool_info, dict):
                                summary = tool_info.get("toolSummary") or tool_info.get("summary")
                            self.status.active_tool_summary = summary or f"Executing {tool_name}"

                            # Track files being edited or written
                            params = tool_info.get("parameters", {}) if isinstance(tool_info, dict) else {}
                            tool_args = su.get("tool_args", {})
                            target_file = (
                                params.get("TargetFile")
                                or params.get("target_file")
                                or params.get("path")
                                or params.get("file_path")
                                or tool_args.get("TargetFile")
                                or tool_args.get("path")
                            )
                            if target_file:
                                full_p = str(target_file).replace("\\", "/")
                                modified_files_set.add(full_p)
                                self.status.files_modified = list(modified_files_set)

                        await self._broadcast(data)
                        yield data

                    # 3. Final completion result
                    elif evt_type == "result":
                        res = data.get("result") or {}
                        status = res.get("status", "SUCCESS")
                        duration = res.get("duration_seconds", round(time.time() - (self.status.start_time or 0), 1))
                        resp_text = res.get("response", full_response)
                        res_files = res.get("files_modified", [])
                        if res_files:
                            for rf in res_files:
                                modified_files_set.add(str(rf).replace("\\", "/"))

                        if status == "SUCCESS":
                            self.status.state = "completed"
                            self.status.error = None
                        else:
                            self.status.state = "error"
                            self.status.error = res.get("error") or res.get("message") or f"Agent task finished with status: {status}"

                        self.status.duration_seconds = duration
                        self.status.latest_output = resp_text
                        self.status.active_tool = None
                        self.status.active_tool_summary = None

                        await self._broadcast(data)
                        yield data

                except json.JSONDecodeError:
                    # Non-JSON progress line (e.g. system banner)
                    raw_event = {"event": "raw_output", "text": line}
                    await self._broadcast(raw_event)
                    yield raw_event

            await self._current_process.wait()

            # Inspect disk for files requested in instruction that now exist
            ws_path = Path(self.workspace_path)
            potential_files = re.findall(r'[\'"`]?([a-zA-Z0-9_\-./\\]+\.[a-zA-Z0-9]{1,5})[\'"`]?', instruction)
            for pf in potential_files:
                candidates = [
                    ws_path / pf,
                    ws_path / "scratch" / Path(pf).name,
                    Path.home() / ".hermes" / "cache" / "scratch" / Path(pf).name,
                    Path(os.environ.get("LOCALAPPDATA", "")) / "hermes" / "cache" / "scratch" / Path(pf).name,
                    Path.home() / ".gemini" / "antigravity-cli" / "scratch" / Path(pf).name,
                ]
                for c in candidates:
                    if c.is_file():
                        # If found in external scratch, copy to project scratch
                        proj_scratch_target = ws_path / "scratch" / c.name
                        if c != proj_scratch_target and not proj_scratch_target.is_file():
                            try:
                                shutil.copy2(c, proj_scratch_target)
                                c = proj_scratch_target
                            except Exception:
                                pass
                        try:
                            rel = str(c.relative_to(ws_path)).replace("\\", "/")
                            modified_files_set.add(rel)
                        except ValueError:
                            modified_files_set.add(str(c).replace("\\", "/"))

            self.status.files_modified = list(modified_files_set)

            # Derive suggested command to run the created code
            self.status.suggested_command = None
            for f in self.status.files_modified:
                f_norm = f.replace("\\", "/").strip()
                if f_norm.endswith(".py"):
                    self.status.suggested_command = f"python {f_norm}"
                    break
                elif f_norm.endswith(".js"):
                    self.status.suggested_command = f"node {f_norm}"
                    break
                elif f_norm.endswith(".ts"):
                    self.status.suggested_command = f"pnpm test"
                    break
                elif f_norm.endswith(".sh"):
                    self.status.suggested_command = f"bash {f_norm}"
                    break

            if self.status.state == "running":
                duration = round(time.time() - (self.status.start_time or 0), 1)
                self.status.state = "completed"
                self.status.duration_seconds = duration
                done_event = {
                    "event": "result",
                    "result": {
                        "status": "SUCCESS",
                        "response": full_response,
                        "duration_seconds": duration,
                        "files_modified": self.status.files_modified,
                        "suggested_command": self.status.suggested_command,
                    }
                }
                await self._broadcast(done_event)
                yield done_event

        except asyncio.CancelledError:
            await self.cancel_task()
            cancel_event = {"event": "cancelled", "message": "Agent task cancelled by user"}
            await self._broadcast(cancel_event)
            yield cancel_event

        except Exception as e:
            self.status.state = "error"
            self.status.error = str(e)
            err_event = {"event": "error", "message": f"Agent execution failed: {str(e)}"}
            await self._broadcast(err_event)
            yield err_event

        finally:
            self._current_process = None

    async def cancel_task(self) -> bool:
        """Cancel and terminate the active Antigravity subprocess."""
        if self._active_async_task and not self._active_async_task.done():
            self._active_async_task.cancel()
            self._active_async_task = None

        if self._current_process and self._current_process.returncode is None:
            pid = self._current_process.pid
            try:
                if os.name == 'nt' and pid:
                    subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True)
                else:
                    self._current_process.terminate()
                    await asyncio.sleep(0.3)
                    if self._current_process.returncode is None:
                        self._current_process.kill()
            except Exception as e:
                print(f"Error terminating agy process: {e}")
            finally:
                self._current_process = None
                self.status.state = "cancelled"
                self.status.active_tool = None
                self.status.active_tool_summary = None
                return True
        return False

    async def execute_command(self, command: str) -> Dict[str, Any]:
        """Execute a shell command in the project workspace."""
        cmd_str = command.strip()
        if not cmd_str:
            return {"exit_code": 1, "output": "No command provided", "error": "Empty command"}
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd_str,
                cwd=self.workspace_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            stdout_data, _ = await proc.communicate()
            output = stdout_data.decode("utf-8", errors="replace") if stdout_data else ""
            return {
                "exit_code": proc.returncode,
                "output": output,
                "command": cmd_str,
                "workspace": self.workspace_path,
            }
        except Exception as e:
            return {"exit_code": 1, "output": f"Command execution failed: {e}", "error": str(e)}

    def reset_status(self) -> Dict[str, Any]:
        """Reset the agent status back to idle if not currently running."""
        if self.status.state != "running":
            self.status = AgentStatus(workspace_path=self.workspace_path)
        return self.get_status()

# Global singleton instance
agent_service = AgentService()
