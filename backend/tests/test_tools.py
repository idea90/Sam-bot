import asyncio
from backend.services.tools import tool_registry
from backend.services.llm import llm_service

async def run_tests():
    print("Testing Sam Tool Registry...")

    # 1. Weather
    weather = await tool_registry.get_weather("Tokyo")
    print("[OK] Weather Test:", weather)
    assert "Tokyo" in weather
    assert "°C" in weather

    # 2. Calculator
    calc = tool_registry.calculate("15 * 8")
    print("[OK] Calculator Test:", calc)
    assert "120" in calc

    # 3. Wikipedia
    wiki = await tool_registry.get_wikipedia("Alan Turing")
    print("[OK] Wikipedia Test:", wiki[:100] + "...")
    assert len(wiki) > 30

    # 4. Web Search
    search = await tool_registry.web_search("latest James Webb Telescope discoveries")
    print("[OK] Web Search Test:", search[:120] + "...")
    assert len(search) > 30
    sources = tool_registry.get_last_sources()
    print("[OK] Web Search Sources:", sources)
    assert len(sources) > 0
    assert "domain" in sources[0]
    assert "url" in sources[0]

    # 5. World Time
    world_time = await tool_registry.get_world_time("London")
    print("[OK] World Time Test:", world_time)
    assert "London" in world_time

    # 6. Currency & Unit Converter
    conv = await tool_registry.convert_units_or_currency("100 USD to EUR")
    print("[OK] Currency Converter Test:", conv)
    assert "USD is equal to" in conv
    conv_unit = await tool_registry.convert_units_or_currency("50 miles to km")
    print("[OK] Unit Converter Test:", conv_unit)
    assert "80.47" in conv_unit

    # 7. Notes
    note_add = tool_registry.manage_notes("add", "Call Alice at 4pm")
    print("[OK] Notes Add Test:", note_add)
    assert "Saved note" in note_add
    note_list = tool_registry.manage_notes("list")
    print("[OK] Notes List Test:", note_list)
    assert "Call Alice" in note_list
    note_clear = tool_registry.manage_notes("clear")
    print("[OK] Notes Clear Test:", note_clear)

    # 8. Random Decisions
    flip = tool_registry.random_decision("flip a coin")
    print("[OK] Coin Flip Test:", flip)
    assert "Heads" in flip or "Tails" in flip
    die = tool_registry.random_decision("roll a die")
    print("[OK] Dice Roll Test:", die)
    assert "rolled" in die

    # 9. System Info
    sys_info = tool_registry.get_system_info()
    print("[OK] System Info Test:", sys_info)
    assert "System running" in sys_info

    # 10. Intent Detection (Multi-tool)
    intent_weather = await llm_service.detect_and_execute_tool("What's the weather in Sydney?")
    assert intent_weather and intent_weather[0] == "weather"
    print("[OK] Intent Weather:", intent_weather[0])

    intent_time = await llm_service.detect_and_execute_tool("What time is it in Tokyo?")
    assert intent_time and intent_time[0] == "world_clock"
    print("[OK] Intent World Clock:", intent_time[0])

    intent_coin = await llm_service.detect_and_execute_tool("Can you flip a coin?")
    assert intent_coin and intent_coin[0] == "randomizer"
    print("[OK] Intent Coin Flip:", intent_coin[0])

    intent_note = await llm_service.detect_and_execute_tool("Take a note: meeting at 3pm")
    assert intent_note and intent_note[0] == "notes"
    print("[OK] Intent Notes:", intent_note[0])

    # 10b. System Control & Media Player
    vol_res = tool_registry.system_control("volume_up")
    print("[OK] System Volume Control:", vol_res)
    assert "volume" in vol_res.lower()

    app_res = tool_registry.system_control("launch_app", "calculator")
    print("[OK] System App Launcher:", app_res)
    assert "calculator" in app_res.lower()

    media_res = tool_registry.media_player("next")
    print("[OK] Media Key Control:", media_res)
    assert "track" in media_res.lower()

    intent_app = await llm_service.detect_and_execute_tool("Open Notepad")
    assert intent_app and intent_app[0] == "system_control"
    print("[OK] Intent App Launcher:", intent_app[0])

    intent_vol = await llm_service.detect_and_execute_tool("turn up the volume")
    assert intent_vol and intent_vol[0] == "system_control"
    print("[OK] Intent Volume:", intent_vol[0])

    intent_media = await llm_service.detect_and_execute_tool("next track")
    assert intent_media and intent_media[0] == "media_player"
    print("[OK] Intent Media Player:", intent_media[0])

    # 10c. Gaming Mode and Image Intent
    intent_gaming = await llm_service.detect_and_execute_tool("let's game")
    assert intent_gaming and intent_gaming[0] == "gaming_mode"
    print("[OK] Intent Gaming Mode:", intent_gaming[0])

    intent_image = await llm_service.detect_and_execute_tool("show me a picture of a red panda")
    assert intent_image and intent_image[0] == "image"
    print("[OK] Intent Image Fetch:", intent_image[0])

    # 11. LLM Tool-augmented Response
    res = await llm_service.get_response(
        messages=[{"role": "user", "content": "What's the weather like in Rome?"}],
        provider="demo"
    )
    print("[OK] LLM Tool-augmented Response:", res)
    assert "Rome" in res["response"]
    assert res["tool_used"] == "weather"

    print("\nALL TOOL & MCP TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_tests())
