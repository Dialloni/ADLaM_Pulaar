"""Intercept the actual API response from akweeyo.com."""
import asyncio
import json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        captured = {}

        async def on_response(resp):
            if "adlambackend" in resp.url or "articles" in resp.url:
                print(f"\n=== RESPONSE: {resp.url} ===")
                print(f"Status: {resp.status}")
                print(f"Headers: {dict(resp.headers)}")
                try:
                    body = await resp.json()
                    captured["data"] = body
                    text = json.dumps(body, ensure_ascii=False, indent=2)
                    print(f"Body (first 3000 chars):\n{text[:3000]}")
                except Exception as e:
                    text = await resp.text()
                    print(f"Body (text, first 3000 chars):\n{text[:3000]}")

        async def on_request(req):
            if "adlambackend" in req.url or "articles" in req.url:
                print(f"\n=== REQUEST: {req.url} ===")
                print(f"Method: {req.method}")
                print(f"Headers: {dict(req.headers)}")

        page.on("request", on_request)
        page.on("response", on_response)

        await page.goto("https://www.akweeyo.com/all-articles", wait_until="networkidle", timeout=30000)
        await browser.close()

asyncio.run(main())
