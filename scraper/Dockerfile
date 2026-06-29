FROM python:3.11-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY scraper/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["python", "scraper/bot.py"]
