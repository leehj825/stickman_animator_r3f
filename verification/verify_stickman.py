import asyncio
from playwright.async_api import async_playwright, expect

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Go to the local dev server
        try:
            await page.goto("http://localhost:5173")

            # Wait for canvas to load
            await page.wait_for_selector("canvas")

            # Wait a bit for the 3D scene to render
            await asyncio.sleep(2)

            # Take a screenshot
            await page.screenshot(path="verification/screenshot.png")
            print("Screenshot taken")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
