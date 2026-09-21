import ast
import asyncio
import base64
import ctypes
import glob
from datetime import datetime
import html
import json
import operator
import os
import platform
import random
import re
import subprocess
import sys
from typing import Any, Dict, List, Optional
import urllib.parse
import webbrowser
import httpx

# WMO Weather interpretation codes
WMO_WEATHER_CODES = {
    0: "clear sky",
    1: "mainly clear",
    2: "partly cloudy",
    3: "overcast",
    45: "foggy",
    48: "depositing rime fog",
    51: "light drizzle",
    53: "moderate drizzle",
    55: "dense drizzle",
    61: "slight rain",
    63: "moderate rain",
    65: "heavy rain",
    71: "slight snow",
    73: "moderate snow",
    75: "heavy snow",
    77: "snow grains",
    80: "slight rain showers",
    81: "moderate rain showers",
    82: "violent rain showers",
    85: "slight snow showers",
    86: "heavy snow showers",
    95: "thunderstorm",
    96: "thunderstorm with slight hail",
    99: "thunderstorm with heavy hail",
}

class ToolRegistry:
    def __init__(self):
        self._notes: List[str] = []
        self.last_sources: List[Dict[str, str]] = []
        self.last_image: Optional[Dict[str, str]] = None
        self.last_media: Optional[Dict[str, Any]] = None

    def clear_last_image(self) -> None:
        """Clear the staged image payload before executing the next tool."""
        self.last_image = None

    def clear_last_media(self) -> None:
        """Clear the staged media payload before executing the next tool."""
        self.last_media = None

    def clear_last_sources(self) -> None:
        """Clear recorded web and news sources before executing next tool."""
        self.last_sources = []

    def get_last_sources(self) -> List[Dict[str, str]]:
        """Return sources visited by recent web searches or news lookups."""
        return list(self.last_sources)

    async def web_search(self, query: str, max_results: int = 4) -> str:
        """Search the live web for fresh information, news, current events, and facts."""
        cleaned_query = query.strip()
        if not cleaned_query:
            return "No search query provided."

        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.post(
                    "https://html.duckduckgo.com/html/",
                    data={"q": cleaned_query},
                    headers=headers
                )
                if r.status_code == 200:
                    snippets = re.findall(r'class="result__snippet"[^>]*>(.*?)</a>', r.text, re.DOTALL)
                    cleaned_snippets = []
                    for s in snippets[:max_results]:
                        clean = html.unescape(re.sub(r'<[^>]+>', '', s).strip())
                        if clean:
                            cleaned_snippets.append(clean)

                    # Extract titles, destination URLs, and domains
                    title_matches = re.findall(r'<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', r.text, re.DOTALL)
                    parsed_sources = []
                    seen_urls = set()
                    for href, title_html in title_matches:
                        clean_title = html.unescape(re.sub(r'<[^>]+>', '', title_html).strip())
                        dest_url = href
                        uddg = re.search(r'uddg=([^&]+)', href)
                        if uddg:
                            dest_url = urllib.parse.unquote(uddg.group(1))

                        if "duckduckgo.com" in dest_url:
                            continue
                        if dest_url in seen_urls:
                            continue
                        seen_urls.add(dest_url)

                        domain_match = re.search(r'https?://(?:www\.)?([^/]+)', dest_url)
                        domain = domain_match.group(1) if domain_match else clean_title

                        parsed_sources.append({
                            "title": clean_title,
                            "url": dest_url,
                            "domain": domain
                        })
                        if len(parsed_sources) >= max_results:
                            break

                    if parsed_sources:
                        self.last_sources = parsed_sources

                    if cleaned_snippets:
                        return "Web Results:\n" + "\n".join(f"• {s}" for s in cleaned_snippets)
        except Exception as e:
            print(f"Web search error: {e}")

        # Fallback to Wikipedia knowledge lookup if query mentions a concept/entity
        return await self.get_wikipedia(cleaned_query)

    async def get_news(self, topic: str = "top") -> str:
        """Fetch real-time live breaking news headlines via Google News RSS."""
        import xml.etree.ElementTree as ET

        topic_clean = topic.strip().lower()
        if not topic_clean or topic_clean in ["top", "general", "today", "news", "breaking", "all"]:
            url = "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en"
            label = "World & Breaking"
        elif "world" in topic_clean:
            url = "https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en"
            label = "World"
        elif "tech" in topic_clean or "ai" in topic_clean:
            url = "https://news.google.com/rss/headlines/section/topic/TECHNOLOGY?hl=en-US&gl=US&ceid=US:en"
            label = "Technology"
        elif any(w in topic_clean for w in ["business", "finance", "stock", "market", "economy"]):
            url = "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=en-US&gl=US&ceid=US:en"
            label = "Business"
        elif "science" in topic_clean or "space" in topic_clean:
            url = "https://news.google.com/rss/headlines/section/topic/SCIENCE?hl=en-US&gl=US&ceid=US:en"
            label = "Science"
        elif "sport" in topic_clean or "game" in topic_clean:
            url = "https://news.google.com/rss/headlines/section/topic/SPORTS?hl=en-US&gl=US&ceid=US:en"
            label = "Sports"
        else:
            q = topic_clean.replace("news", "").strip() or topic_clean
            url = f"https://news.google.com/rss/search?q={q}&hl=en-US&gl=US&ceid=US:en"
            label = topic_clean.title()

        try:
            async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
                r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                if r.status_code == 200:
                    root = ET.fromstring(r.text)
                    items = root.findall(".//item")
                    headlines = []
                    news_sources = []
                    for item in items[:4]:
                        title_el = item.find("title")
                        link_el = item.find("link")
                        source_el = item.find("source")

                        raw_title = title_el.text.strip() if title_el is not None and title_el.text else ""
                        clean_t = re.sub(r' - [^-]+$', '', raw_title)
                        if clean_t:
                            headlines.append(clean_t)

                        source_name = source_el.text.strip() if source_el is not None and source_el.text else ""
                        source_url = source_el.attrib.get("url", "") if source_el is not None else ""
                        article_link = link_el.text.strip() if link_el is not None and link_el.text else ""

                        domain_match = re.search(r'https?://(?:www\.)?([^/]+)', source_url or article_link)
                        domain = domain_match.group(1) if domain_match else (source_name or "news.google.com")

                        news_sources.append({
                            "title": clean_t or raw_title or source_name,
                            "url": source_url or article_link,
                            "domain": domain
                        })

                    if news_sources:
                        self.last_sources = news_sources

                    if headlines:
                        return f"Latest {label} Headlines:\n" + "\n".join(f"• {h}" for h in headlines)
        except Exception as e:
            print(f"Error fetching news: {e}")

        return await self.web_search(f"latest {topic_clean} headlines")

    async def get_weather(self, location: str) -> str:
        """Get current live weather forecast for any city or location in the world."""
        cleaned_loc = re.sub(r'^(weather in|weather for|current weather in)\s*', '', location.strip(), flags=re.IGNORECASE)
        if not cleaned_loc:
            return "Please provide a valid city or location name."
        city_display = cleaned_loc.strip().title()

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                # 1. Geocode location name
                geo_resp = await client.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": cleaned_loc, "count": 1, "language": "en", "format": "json"}
                )
                if geo_resp.status_code != 200:
                    return f"Could not find coordinates for '{city_display}'."

                geo_data = geo_resp.json()
                results = geo_data.get("results")
                if not results:
                    return f"Location '{city_display}' was not found. Please specify city and country."

                top = results[0]
                lat = top["latitude"]
                lon = top["longitude"]
                city_name = top.get("name", city_display)
                country = top.get("country", "")

                # 2. Fetch live forecast
                weather_resp = await client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
                        "temperature_unit": "celsius"
                    }
                )
                if weather_resp.status_code != 200:
                    return f"Could not retrieve weather data for {city_name}."

                current = weather_resp.json().get("current", {})
                temp = current.get("temperature_2m")
                feels_like = current.get("apparent_temperature")
                humidity = current.get("relative_humidity_2m")
                wind = current.get("wind_speed_10m")
                wmo_code = current.get("weather_code", 0)
                condition = WMO_WEATHER_CODES.get(wmo_code, "partly cloudy")

                return (
                    f"Current weather in {city_name}, {country}: {condition}, {temp}°C "
                    f"(feels like {feels_like}°C), humidity at {humidity}%, wind speed {wind} km/h."
                )
        except Exception as e:
            return f"Weather service currently unavailable for {city_display}: {e}"

    async def get_wikipedia(self, topic: str) -> str:
        """Look up a concise summary of people, places, concepts, or history on Wikipedia."""
        raw_topic = topic.strip()
        cleaned_topic = urllib.parse.quote(raw_topic)
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/{cleaned_topic}",
                    headers={"User-Agent": "SamVoiceAssistant/1.0 (contact@sam.ai)"}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    extract = data.get("extract")
                    title_wiki = data.get("title", raw_topic.title())
                    page_url = data.get("content_urls", {}).get("desktop", {}).get("page", f"https://en.wikipedia.org/wiki/{cleaned_topic}")
                    self.last_sources = [{
                        "title": f"{title_wiki} - Wikipedia",
                        "url": page_url,
                        "domain": "en.wikipedia.org"
                    }]
                    if extract:
                        return f"From Wikipedia: {extract}"
        except Exception as e:
            print(f"Wikipedia lookup error: {e}")
        return f"No encyclopedia article found for '{topic}'."

    @staticmethod
    def calculate(expression: str) -> str:
        """Safely evaluate basic mathematical expressions."""
        operators = {
            ast.Add: operator.add,
            ast.Sub: operator.sub,
            ast.Mult: operator.mul,
            ast.Div: operator.truediv,
            ast.Pow: operator.pow,
            ast.BitXor: operator.pow, # Treat ^ as exponentiation for natural math input
            ast.USub: operator.neg,
        }

        def eval_node(node):
            if isinstance(node, ast.Constant):
                return node.value
            elif isinstance(node, ast.BinOp):
                return operators[type(node.op)](eval_node(node.left), eval_node(node.right))
            elif isinstance(node, ast.UnaryOp):
                return operators[type(node.op)](eval_node(node.operand))
            raise TypeError(f"Unsupported mathematical syntax: {ast.dump(node)}")

        try:
            # Clean expression and convert ^ to ** for exponentiation
            cleaned = re.sub(r'[^0-9+\-*/().^ ]', '', expression)
            cleaned = cleaned.replace('^', '**')
            tree = ast.parse(cleaned, mode='eval')
            result = eval_node(tree.body)
            return f"{expression} = {result}"
        except ZeroDivisionError:
            return "Cannot divide by zero."
        except Exception as e:
            return f"Could not calculate expression: {e}"

    @staticmethod
    async def get_world_time(location: str) -> str:
        """Get the current local time, date, and timezone for any city or location."""
        cleaned_loc = re.sub(r'^(time in|current time in|what time is it in)\s*', '', location.strip(), flags=re.IGNORECASE)
        cleaned_loc = cleaned_loc.strip(' ?.')
        if not cleaned_loc:
            return "Please specify a city or location to check the time."

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                geo = await client.get(
                    "https://geocoding-api.open-meteo.com/v1/search",
                    params={"name": cleaned_loc, "count": 1, "language": "en"}
                )
                if geo.status_code != 200 or not geo.json().get("results"):
                    return f"Could not find geographic location for '{cleaned_loc}'."

                top = geo.json()["results"][0]
                lat, lon = top["latitude"], top["longitude"]
                city, country = top.get("name", cleaned_loc), top.get("country", "")

                r = await client.get(
                    "https://api.open-meteo.com/v1/forecast",
                    params={"latitude": lat, "longitude": lon, "current": "temperature_2m", "timezone": "auto"}
                )
                if r.status_code != 200:
                    return f"Could not retrieve time data for {city}."

                data = r.json()
                raw_time = data.get("current", {}).get("time", "")
                dt = datetime.fromisoformat(raw_time)
                tz = data.get("timezone", "")
                fmt_time = dt.strftime("%I:%M %p")
                fmt_date = dt.strftime("%A, %B %d")
                location_display = f"{city}, {country}" if country else city
                return f"The current local time in {location_display} is {fmt_time} on {fmt_date} ({tz})."
        except Exception as e:
            return f"Could not check world clock: {e}"

    @staticmethod
    async def convert_units_or_currency(query: str) -> str:
        """Convert currencies, temperatures, weights, and distances."""
        q = query.lower().strip()

        # 1. Temperature conversions
        m_f_to_c = re.search(r'(-?\d+(?:\.\d+)?)\s*(?:degrees?\s*)?(?:f|fahrenheit)\s*(?:to|in|into)\s*(?:c|celsius)', q)
        if m_f_to_c:
            f = float(m_f_to_c.group(1))
            c = (f - 32) * 5 / 9
            return f"{f:g} degrees Fahrenheit is equal to {c:.1f} degrees Celsius."

        m_c_to_f = re.search(r'(-?\d+(?:\.\d+)?)\s*(?:degrees?\s*)?(?:c|celsius)\s*(?:to|in|into)\s*(?:f|fahrenheit)', q)
        if m_c_to_f:
            c = float(m_c_to_f.group(1))
            f = (c * 9 / 5) + 32
            return f"{c:g} degrees Celsius is equal to {f:.1f} degrees Fahrenheit."

        # 2. Distance / Length
        m_mi_km = re.search(r'(\d+(?:\.\d+)?)\s*(?:miles?|mi)\s*(?:to|in|into)\s*(?:km|kilometers?)', q)
        if m_mi_km:
            mi = float(m_mi_km.group(1))
            km = mi * 1.60934
            return f"{mi:g} miles is equal to {km:.2f} kilometers."

        m_km_mi = re.search(r'(\d+(?:\.\d+)?)\s*(?:km|kilometers?)\s*(?:to|in|into)\s*(?:miles?|mi)', q)
        if m_km_mi:
            km = float(m_km_mi.group(1))
            mi = km * 0.621371
            return f"{km:g} kilometers is equal to {mi:.2f} miles."

        m_m_ft = re.search(r'(\d+(?:\.\d+)?)\s*(?:meters?|m)\s*(?:to|in|into)\s*(?:feet|ft)', q)
        if m_m_ft:
            m = float(m_m_ft.group(1))
            ft = m * 3.28084
            return f"{m:g} meters is equal to {ft:.2f} feet."

        m_ft_m = re.search(r'(\d+(?:\.\d+)?)\s*(?:feet|ft)\s*(?:to|in|into)\s*(?:meters?|m)', q)
        if m_ft_m:
            ft = float(m_ft_m.group(1))
            m = ft * 0.3048
            return f"{ft:g} feet is equal to {m:.2f} meters."

        # 3. Weight
        m_kg_lbs = re.search(r'(\d+(?:\.\d+)?)\s*(?:kg|kilograms?)\s*(?:to|in|into)\s*(?:lbs?|pounds?)', q)
        if m_kg_lbs:
            kg = float(m_kg_lbs.group(1))
            lbs = kg * 2.20462
            return f"{kg:g} kilograms is equal to {lbs:.2f} pounds."

        m_lbs_kg = re.search(r'(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)\s*(?:to|in|into)\s*(?:kg|kilograms?)', q)
        if m_lbs_kg:
            lbs = float(m_lbs_kg.group(1))
            kg = lbs * 0.453592
            return f"{lbs:g} pounds is equal to {kg:.2f} kilograms."

        # 4. Currency conversion (e.g. 100 USD to EUR, convert 50 EUR in GBP)
        curr_match = re.search(r'(\d+(?:\.\d+)?)\s*([a-zA-Z]{3})\s*(?:to|in|into)\s*([a-zA-Z]{3})', q)
        if curr_match:
            amt = float(curr_match.group(1))
            from_curr = curr_match.group(2).upper()
            to_curr = curr_match.group(3).upper()
            try:
                async with httpx.AsyncClient(timeout=8.0) as client:
                    r = await client.get(f"https://open.er-api.com/v6/latest/{from_curr}")
                    if r.status_code == 200:
                        data = r.json()
                        rate = data.get("rates", {}).get(to_curr)
                        if rate:
                            converted = amt * rate
                            return f"{amt:,.2f} {from_curr} is equal to {converted:,.2f} {to_curr} (exchange rate: {rate:.4f})."
            except Exception as e:
                print(f"Currency error: {e}")

        return f"Could not perform conversion for '{query}'. Try queries like '100 USD to EUR', '50 miles to km', or '75 F to C'."

    def manage_notes(self, action: str, content: str = "") -> str:
        """Create, read, or clear quick notes."""
        action = action.lower().strip()
        if action == "add":
            clean_note = content.strip()
            if not clean_note:
                return "Please provide content for the note."
            self._notes.append(clean_note)
            return f"Saved note: '{clean_note}'. You now have {len(self._notes)} note(s)."
        elif action in ["list", "read", "get"]:
            if not self._notes:
                return "You don't have any saved notes yet."
            items = [f"{i+1}. {n}" for i, n in enumerate(self._notes)]
            return f"You have {len(self._notes)} note(s): " + "; ".join(items)
        elif action in ["clear", "delete", "reset"]:
            count = len(self._notes)
            self._notes.clear()
            return f"Cleared {count} note(s)."
        return f"Unrecognized note action: {action}."

    @staticmethod
    def random_decision(query: str) -> str:
        """Coin flips, dice rolls, number pickers, and decision answers."""
        q = query.lower()
        if "coin" in q:
            flip = random.choice(["Heads", "Tails"])
            return f"I flipped a coin and it landed on {flip}!"
        elif "die" in q or "dice" in q:
            m = re.search(r'(\d+)\s*sides?', q)
            sides = int(m.group(1)) if m else 6
            roll = random.randint(1, max(sides, 2))
            return f"You rolled a {roll} (on a {sides}-sided die)!"
        elif "number" in q:
            m = re.search(r'between\s+(\d+)\s+and\s+(\d+)', q)
            if m:
                a, b = int(m.group(1)), int(m.group(2))
                pick = random.randint(min(a, b), max(a, b))
                return f"I picked the number {pick}."
            return f"I picked the number {random.randint(1, 100)}."
        return random.choice([
            "Yes, definitely!",
            "My answer is no.",
            "Signs point to yes.",
            "I wouldn't count on it.",
            "Outlook is very positive!"
        ])

    @staticmethod
    def get_system_info() -> str:
        """Get safe OS and runtime environment diagnostics."""
        os_name = platform.system()
        os_release = platform.release()
        arch = platform.machine()
        py_ver = platform.python_version()
        return f"System running {os_name} {os_release} ({arch}) with Python {py_ver}. Sam voice assistant is active and operational."

    @staticmethod
    def _send_vk_key(vk_code: int, times: int = 1) -> None:
        """Send virtual key events via Windows user32."""
        try:
            for _ in range(times):
                ctypes.windll.user32.keybd_event(vk_code, 0, 0, 0)
                ctypes.windll.user32.keybd_event(vk_code, 0, 2, 0) # KEYEVENTF_KEYUP = 2
        except Exception as e:
            print(f"Key event error: {e}")

    def system_control(self, action: str, target: Optional[str] = None) -> str:
        """Control Windows system functions: launch applications, adjust volume, lock PC."""
        act = (action or "").lower().strip()
        tgt = (target or "").lower().strip()

        # Volume Controls
        if act in ["volume_up", "vol_up"] or "up" in act:
            self._send_vk_key(0xAF, times=3) # VK_VOLUME_UP
            return "Turned the volume up."
        elif act in ["volume_down", "vol_down"] or "down" in act:
            self._send_vk_key(0xAE, times=3) # VK_VOLUME_DOWN
            return "Turned the volume down."
        elif act in ["mute", "unmute", "volume_mute"]:
            self._send_vk_key(0xAD, times=1) # VK_VOLUME_MUTE
            return "Toggled audio mute."

        # Lock PC
        elif act in ["lock", "lock_pc", "lock_computer", "lock_workstation"]:
            try:
                ctypes.windll.user32.LockWorkStation()
                return "Workstation locked."
            except Exception as e:
                return f"Could not lock workstation: {e}"

        # App Launcher
        elif act in ["launch", "open", "launch_app", "open_app"]:
            APP_MAP = {
                "code": "code",
                "vs code": "code",
                "vscode": "code",
                "visual studio code": "code",
                "chrome": "chrome",
                "google chrome": "chrome",
                "browser": "chrome",
                "notepad": "notepad.exe",
                "notes app": "notepad.exe",
                "calculator": "calc.exe",
                "calc": "calc.exe",
                "terminal": "wt.exe",
                "cmd": "cmd.exe",
                "command prompt": "cmd.exe",
                "powershell": "powershell.exe",
                "explorer": "explorer.exe",
                "files": "explorer.exe",
                "file explorer": "explorer.exe",
                "task manager": "taskmgr.exe",
                "taskmgr": "taskmgr.exe",
                "settings": "ms-settings:",
                "roblox": "uri:roblox-player:",
                "discord": "uri:discord://",
            }

            matched_cmd = None
            app_display_name = tgt.title()

            # Exact match first, then meaningful substring match (>= 3 chars)
            for key, cmd in APP_MAP.items():
                if key == tgt:
                    matched_cmd = cmd
                    app_display_name = key.title()
                    break

            if not matched_cmd and len(tgt) >= 3:
                for key, cmd in APP_MAP.items():
                    if key in tgt or tgt in key:
                        matched_cmd = cmd
                        app_display_name = key.title()
                        break

            if not matched_cmd:
                # Never execute an unknown target from user speech — just tell the user
                return f"I don't know how to open '{app_display_name}'. Try an app I support, like Chrome, Notepad, Calculator, or Terminal."

            try:
                if matched_cmd.startswith("uri:"):
                    os.startfile(matched_cmd[len("uri:"):])
                    return f"Opening {app_display_name} for you."
                elif matched_cmd.startswith("ms-settings"):
                    os.startfile(matched_cmd)
                elif matched_cmd in ["notepad.exe", "calc.exe", "explorer.exe", "taskmgr.exe"]:
                    subprocess.Popen([matched_cmd], shell=True)
                elif matched_cmd == "wt.exe":
                    # Fallback to PowerShell if Windows Terminal is not installed
                    subprocess.Popen("start wt.exe 2>nul || start powershell.exe", shell=True)
                else:
                    subprocess.Popen(f"start {matched_cmd}", shell=True)
                return f"Opening {app_display_name} for you."
            except Exception as e:
                return f"Could not open {app_display_name}: {e}"

        # Gaming Mode
        elif act in ["gaming_mode", "gaming", "game_mode"]:
            return self.launch_gaming_mode()

        return f"Unknown system control action: {action}"

    @staticmethod
    def _domain_of(url: str) -> str:
        m = re.search(r'https?://(?:www\.)?([^/]+)', url or "")
        return m.group(1) if m else ""

    async def _get_wikipedia_image(self, topic: str) -> tuple:
        """Fallback: get the main image of a Wikipedia article."""
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(topic)}",
                    headers={"User-Agent": "SamVoiceAssistant/1.0 (contact@sam.ai)"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    img = (data.get("originalimage") or {}).get("source") or (data.get("thumbnail") or {}).get("source")
                    page = data.get("content_urls", {}).get("desktop", {}).get("page", "")
                    return img, page, data.get("title", topic.title())
        except Exception as e:
            print(f"Wikipedia image lookup error: {e}")
        return None, "", topic.title()

    async def fetch_image(self, query: str) -> str:
        """Fetch a relevant image for a query and stage it for display in the UI."""
        cleaned = query.strip()
        if not cleaned:
            return "Please tell me what image you'd like to see."

        candidates: List[Dict[str, str]] = []

        # 1. DuckDuckGo image search (ddgs package, runs in a thread: it is blocking)
        try:
            def _search_images() -> List[Dict[str, Any]]:
                try:
                    from ddgs import DDGS
                except ImportError:
                    from duckduckgo_search import DDGS
                with DDGS() as d:
                    return list(d.images(cleaned, max_results=5))

            for r in await asyncio.to_thread(_search_images):
                img_url = (r or {}).get("image")
                if img_url:
                    page = (r or {}).get("url", "")
                    candidates.append({
                        "image_url": img_url,
                        "page_url": page,
                        "title": (r or {}).get("title", cleaned.title()),
                        "domain": self._domain_of(page) or self._domain_of(img_url),
                    })
        except Exception as e:
            print(f"Image search error: {e}")

        # 2. Fallback: Wikipedia article image
        if not candidates:
            wiki_img, wiki_page, wiki_title = await self._get_wikipedia_image(cleaned)
            if wiki_img:
                candidates.append({
                    "image_url": wiki_img,
                    "page_url": wiki_page,
                    "title": wiki_title,
                    "domain": self._domain_of(wiki_page) or "en.wikipedia.org",
                })

        # Download the first candidate that actually returns image bytes.
        # NOTE: Wikimedia (and some CDNs) block generic browser User-Agents with 403,
        # so a descriptive app UA is required for image downloads.
        for c in candidates:
            try:
                async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                    r = await client.get(c["image_url"], headers={"User-Agent": "SamVoiceAssistant/1.0 (contact@sam.ai)"})
                ctype = r.headers.get("content-type", "").split(";")[0].strip()
                if r.status_code == 200 and ctype.startswith("image/") and 0 < len(r.content) <= 6_000_000:
                    b64 = base64.b64encode(r.content).decode("utf-8")
                    self.last_image = {
                        "data_url": f"data:{ctype};base64,{b64}",
                        "source_url": c["page_url"],
                        "title": c["title"],
                        "domain": c["domain"],
                    }
                    if c["page_url"]:
                        self.last_sources = [{
                            "title": c["title"],
                            "url": c["page_url"],
                            "domain": c["domain"],
                        }]
                    return f"Here is an image of {cleaned}."
            except Exception:
                continue

        return f"I couldn't fetch an image of {cleaned}. Try a different description."

    def _launch_app_flexible(
        self,
        name: str,
        uri: str,
        exe_patterns: List[str],
        exe_args: Optional[List[str]] = None,
    ) -> str:
        """Try to launch an app via its URI protocol first, then known install paths."""
        try:
            os.startfile(uri)  # type: ignore[attr-defined]
            return f"{name} launched."
        except Exception:
            pass

        for pattern in exe_patterns:
            matches = sorted(glob.glob(os.path.expandvars(pattern)))
            if matches:
                exe = matches[-1]  # prefer the newest installed version
                try:
                    subprocess.Popen([exe] + (exe_args or []))
                    return f"{name} launched."
                except Exception:
                    continue
        return f"Could not launch {name}. Is it installed?"

    def launch_gaming_mode(self) -> str:
        """Activate gaming mode: launch Roblox and Discord automatically."""
        roblox_res = self._launch_app_flexible(
            "Roblox",
            "roblox-player:",
            [
                r"%LOCALAPPDATA%\\Roblox\\Versions\\version-*\\RobloxPlayerBeta.exe",
                r"%PROGRAMFILES(X86)%\\Roblox\\Versions\\RobloxPlayerBeta.exe",
            ],
        )
        discord_res = self._launch_app_flexible(
            "Discord",
            "discord://",
            [
                r"%LOCALAPPDATA%\\Discord\\app-*\\Discord.exe",
                r"%LOCALAPPDATA%\\Discord\\Update.exe",
            ],
            exe_args=["--processStart", "Discord.exe"],
        )
        return f"Gaming mode activated! {roblox_res} {discord_res}"

    def _search_youtube_track(self, query: str) -> Optional[Dict[str, Any]]:
        """Search YouTube and extract direct video metadata for immediate playback."""
        q = (query or "").strip()
        if not q:
            return None

        # Clean query: strip common music command prefixes
        q_clean = re.sub(r'^(?:play|listen to|put on)\s+', '', q, flags=re.IGNORECASE).strip()
        search_target = q_clean or q
        search_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(search_target)}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
        try:
            with httpx.Client(timeout=8.0, follow_redirects=True, headers=headers) as client:
                resp = client.get(search_url)
                html_text = resp.text

            # Strategy 1: Extract from ytInitialData
            pattern = r"var ytInitialData = ({.*?});</script>"
            match = re.search(pattern, html_text)
            if match:
                try:
                    data = json.loads(match.group(1))
                    contents = data.get("contents", {}).get("twoColumnSearchResultsRenderer", {}).get("primaryContents", {}).get("sectionListRenderer", {}).get("contents", [])
                    for section in contents:
                        items = section.get("itemSectionRenderer", {}).get("contents", [])
                        for item in items:
                            video = item.get("videoRenderer")
                            if video and "videoId" in video:
                                vid_id = video["videoId"]
                                title = "".join(r.get("text", "") for r in video.get("title", {}).get("runs", []))
                                channel = "".join(r.get("text", "") for r in video.get("ownerText", {}).get("runs", []))
                                duration = video.get("lengthText", {}).get("simpleText", "")
                                return {
                                    "video_id": vid_id,
                                    "title": title or search_target,
                                    "channel": channel or "YouTube Music",
                                    "duration": duration,
                                    "watch_url": f"https://www.youtube.com/watch?v={vid_id}",
                                    "music_url": f"https://music.youtube.com/watch?v={vid_id}",
                                    "embed_url": f"https://www.youtube-nocookie.com/embed/{vid_id}?autoplay=1",
                                    "thumbnail": f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg",
                                }
                except Exception:
                    pass

            # Strategy 2: Fallback regex for watch?v=
            video_ids = re.findall(r"/watch\?v=([a-zA-Z0-9_-]{11})", html_text)
            if video_ids:
                seen = set()
                for vid in video_ids:
                    if vid not in seen:
                        return {
                            "video_id": vid,
                            "title": search_target,
                            "channel": "YouTube Music",
                            "duration": "",
                            "watch_url": f"https://www.youtube.com/watch?v={vid}",
                            "music_url": f"https://music.youtube.com/watch?v={vid}",
                            "embed_url": f"https://www.youtube-nocookie.com/embed/{vid}?autoplay=1",
                            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
                        }
        except Exception as e:
            print(f"YouTube search error: {e}")

        return None

    def media_player(self, action: str, query: Optional[str] = None) -> str:
        """Control audio/video playback or search and play music on YouTube / YouTube Music."""
        act = (action or "").lower().strip()
        q = (query or "").strip()

        if act in ["play_pause", "pause", "resume", "play"]:
            if not q or act in ["pause", "resume", "play_pause"]:
                self._send_vk_key(0xB3, times=1) # VK_MEDIA_PLAY_PAUSE
                return "Toggled media playback."

        if act in ["next", "next_track", "skip"]:
            self._send_vk_key(0xB0, times=1) # VK_MEDIA_NEXT_TRACK
            return "Skipped to the next track."

        if act in ["previous", "prev", "prev_track"]:
            self._send_vk_key(0xB1, times=1) # VK_MEDIA_PREV_TRACK
            return "Went back to the previous track."

        if act in ["search_play", "play_music", "play_song", "play"] and q:
            track = self._search_youtube_track(q)
            if track:
                self.last_media = track
                self.last_sources = [
                    {
                        "title": f"YouTube Music: {track['title']}",
                        "url": track["music_url"],
                        "domain": "music.youtube.com"
                    },
                    {
                        "title": f"YouTube: {track['title']}",
                        "url": track["watch_url"],
                        "domain": "youtube.com"
                    }
                ]
                try:
                    # Open direct video/music URL rather than a generic search page
                    webbrowser.open(track["watch_url"])
                except Exception:
                    pass
                return f"Now playing '{track['title']}' on YouTube Music for you."
            else:
                search_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(q)}"
                try:
                    webbrowser.open(search_url)
                    self.last_sources = [{
                        "title": f"YouTube: {q}",
                        "url": search_url,
                        "domain": "youtube.com"
                    }]
                except Exception:
                    pass
                return f"Playing '{q}' on YouTube for you."

        return f"Unknown media player command: {action}"

    async def antigravity_control(self, action: str, instruction: Optional[str] = None) -> str:
        """Control and monitor Google Antigravity coding agent."""
        from .agent_service import agent_service
        act = (action or "").lower().strip()
        inst = (instruction or "").strip()

        if act in ["dispatch", "dispatch_task", "run", "start", "code"]:
            if not inst:
                return "What task or bug would you like me to assign to the coding agent?"
            if agent_service.status.state == "running":
                curr = agent_service.status.current_task or "another task"
                return f"Antigravity is currently busy working on: '{curr}'. Please wait for it to finish or say 'cancel agent' first."

            # Start task as background asyncio task
            async def _run():
                async for _ in agent_service.dispatch_task(inst):
                    pass
            asyncio.create_task(_run())
            return f"I've dispatched that task to Antigravity: '{inst}'. I will monitor its progress and let you know when it's done."

        if act in ["status", "check", "check_status", "progress"]:
            st = agent_service.get_status()
            if st["state"] == "running":
                curr_task = st.get("current_task", "a coding task")
                tool_summary = st.get("active_tool_summary") or st.get("active_tool") or "thinking and planning"
                dur = st.get("duration_seconds", 0)
                files = len(st.get("files_modified", []))
                return f"Antigravity is actively working on '{curr_task}'. Currently {tool_summary} ({dur}s elapsed, {files} files touched)."
            elif st["state"] == "completed":
                dur = st.get("duration_seconds", 0)
                return f"The coding agent is idle. The last task completed successfully in {dur} seconds."
            elif st["state"] == "cancelled":
                return "The coding agent was cancelled and is currently idle."
            elif st["state"] == "error":
                return f"The coding agent is idle. The last task encountered an error: {st.get('error', 'unknown error')}."
            else:
                return "The coding agent is currently idle and ready for a task."

        if act in ["cancel", "stop", "abort", "kill"]:
            cancelled = await agent_service.cancel_task()
            if cancelled:
                return "I've cancelled the coding agent's active task."
            return "No coding agent task is currently running."

        if act in ["models", "list_models"]:
            models = await agent_service.list_models()
            names = [m["name"] for m in models[:4]]
            return f"Antigravity supports several models including: {', '.join(names)}."

        return f"Unknown coding agent command: {action}"

    @classmethod
    def get_definitions(cls) -> List[Dict[str, Any]]:
        """Return standardized OpenAI/Gemini tool schemas."""
        return [
            {
                "type": "function",
                "function": {
                    "name": "web_search",
                    "description": "Search the live web for fresh real-time information, news, current events, recent developments, and factual queries.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query to look up on the web"
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_news",
                    "description": "Get the latest breaking news headlines, world news, tech news, or topic-specific news.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "topic": {
                                "type": "string",
                                "description": "The category or search topic for news (e.g. 'world', 'technology', 'business', 'sports', 'top')"
                            }
                        },
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_weather",
                    "description": "Get the real-time weather and forecast for any city or location in the world.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {
                                "type": "string",
                                "description": "The city or geographic location name (e.g. Tokyo, London, New York)"
                            }
                        },
                        "required": ["location"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_wikipedia",
                    "description": "Look up an informative summary of a person, historical event, place, or scientific concept.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "topic": {
                                "type": "string",
                                "description": "The topic or subject name to look up"
                            }
                        },
                        "required": ["topic"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "calculate",
                    "description": "Calculate mathematical expressions and percentages.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "expression": {
                                "type": "string",
                                "description": "The arithmetic expression to evaluate (e.g. 15 * 85 / 100)"
                            }
                        },
                        "required": ["expression"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_world_time",
                    "description": "Get the current local time, date, and timezone for any city or country in the world.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "location": {
                                "type": "string",
                                "description": "The city or location name (e.g. London, Tokyo, Paris, New York)"
                            }
                        },
                        "required": ["location"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "convert_units_or_currency",
                    "description": "Convert currencies (USD, EUR, GBP, JPY), distances, weights, and temperatures.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The conversion query (e.g. '100 USD to EUR', '50 miles to km', '75 F to C')"
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "manage_notes",
                    "description": "Create, list, or clear quick notes and reminders.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "description": "'add' to save a note, 'list' to read notes, 'clear' to erase all notes"
                            },
                            "content": {
                                "type": "string",
                                "description": "The text content of the note (required if action is 'add')"
                            }
                        },
                        "required": ["action"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "random_decision",
                    "description": "Flip a coin, roll dice, pick a random number, or get a random decision.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "The action requested (e.g. 'flip a coin', 'roll a die', 'pick a number between 1 and 100')"
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "fetch_image",
                    "description": "Fetch and display an image of anything the user asks for (people, places, animals, things).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "What the image should show (e.g. 'a red panda', 'Eiffel Tower at night')"
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "gaming_mode",
                    "description": "Activate gaming mode: automatically launch Roblox and Discord for a gaming session.",
                    "parameters": {
                        "type": "object",
                        "properties": {}
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_system_info",
                    "description": "Get operating system, runtime diagnostics, and system health status.",
                    "parameters": {
                        "type": "object",
                        "properties": {}
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "system_control",
                    "description": "Control Windows system features: launch applications (VS Code, Chrome, Notepad, Calc, Terminal, Explorer), adjust volume, or lock PC.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "description": "'launch_app', 'volume_up', 'volume_down', 'mute', 'lock_pc'"
                            },
                            "target": {
                                "type": "string",
                                "description": "The app or target name when launching apps (e.g. 'code', 'chrome', 'notepad')"
                            }
                        },
                        "required": ["action"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "media_player",
                    "description": "Control playback (play/pause, next track, previous track) or search and play music on YouTube.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "description": "'play_pause', 'next', 'previous', 'search_play'"
                            },
                            "query": {
                                "type": "string",
                                "description": "Song title or artist when searching music"
                            }
                        },
                        "required": ["action"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "antigravity_control",
                    "description": "Control and check status of Google Antigravity autonomous coding agent for programming tasks, debugging, and code modifications.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "action": {
                                "type": "string",
                                "enum": ["dispatch", "status", "cancel", "models"],
                                "description": "Action to take: 'dispatch' to assign a task, 'status' to check current activity, 'cancel' to stop execution, or 'models' to list models."
                            },
                            "instruction": {
                                "type": "string",
                                "description": "The specific coding or engineering instruction when dispatching a task."
                            }
                        },
                        "required": ["action"]
                    }
                }
            }
        ]

    async def execute_tool(self, name: str, args: Dict[str, Any]) -> str:
        """Execute tool by name with arguments."""
        if name == "get_news":
            return await self.get_news(args.get("topic", "top"))
        elif name == "web_search":
            return await self.web_search(args.get("query", ""))
        elif name == "get_weather":
            return await self.get_weather(args.get("location", ""))
        elif name == "get_wikipedia":
            return await self.get_wikipedia(args.get("topic", ""))
        elif name == "calculate":
            return self.calculate(args.get("expression", ""))
        elif name == "get_world_time":
            return await self.get_world_time(args.get("location", ""))
        elif name == "convert_units_or_currency":
            return await self.convert_units_or_currency(args.get("query", ""))
        elif name == "manage_notes":
            return self.manage_notes(args.get("action", "list"), args.get("content", ""))
        elif name == "random_decision":
            return self.random_decision(args.get("query", ""))
        elif name == "fetch_image":
            return await self.fetch_image(args.get("query", ""))
        elif name == "gaming_mode":
            return self.launch_gaming_mode()
        elif name == "get_system_info":
            return self.get_system_info()
        elif name == "system_control":
            return self.system_control(args.get("action", ""), args.get("target", ""))
        elif name == "media_player":
            return self.media_player(args.get("action", ""), args.get("query", ""))
        elif name in ["antigravity_control", "coding_agent"]:
            return await self.antigravity_control(args.get("action", ""), args.get("instruction", ""))
        return f"Unknown tool: {name}"

tool_registry = ToolRegistry()
