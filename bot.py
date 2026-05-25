"""Entry point for Railway deployment — delegates to scraper/bot.py"""
import runpy
import os
import sys

scraper_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "scraper")
os.chdir(scraper_dir)
sys.path.insert(0, scraper_dir)
runpy.run_path(os.path.join(scraper_dir, "bot.py"), run_name="__main__")
