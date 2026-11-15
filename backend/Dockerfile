FROM node:20 AS frontend-build
WORKDIR /app/frontend
COPY frontend/ ./
RUN npm ci
ENV VITE_API_URL=/api
RUN npm run build

FROM python:3.12-slim
WORKDIR /app/backend
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY --from=frontend-build /app/frontend/dist /app/frontend_dist
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
