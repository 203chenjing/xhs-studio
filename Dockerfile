FROM python:3.12-slim

WORKDIR /app
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
ENV PYTHONUNBUFFERED=1
EXPOSE 8765

CMD ["python", "main.py"]
