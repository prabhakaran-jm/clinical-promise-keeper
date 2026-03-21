#!/bin/bash
# Deploy to Google Cloud Run
set -e

# No API keys or tokens in this file — authenticate via gcloud / CI service account.
PROJECT_ID="${GCP_PROJECT_ID:-agent-assemble-end-game}"

# Cloud Run region (where the service runs) — separate from Gemini API location
CLOUD_RUN_REGION="${CLOUD_RUN_REGION:-us-central1}"

# Gemini / Vertex AI location — use "global" for GenAI, NOT the Cloud Run region
GCP_LOCATION="${GCP_LOCATION:-global}"

SERVICE_NAME="clinical-promise-keeper"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"
GEMINI_MODEL_VALUE="${GEMINI_MODEL:-gemini-3.1-flash-lite-preview}"

echo "Building container image..."
gcloud builds submit --tag "$IMAGE" --project "$PROJECT_ID"

echo "Deploying to Cloud Run (region=$CLOUD_RUN_REGION, GCP_LOCATION for Gemini=$GCP_LOCATION)..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$CLOUD_RUN_REGION" \
  --project "$PROJECT_ID" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 3 \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=$GCP_LOCATION,GEMINI_MODEL=$GEMINI_MODEL_VALUE" \
  --timeout 300

echo "Deployment complete!"
ENDPOINT=$(gcloud run services describe "$SERVICE_NAME" --region "$CLOUD_RUN_REGION" --project "$PROJECT_ID" --format='value(status.url)')
echo "Service URL: $ENDPOINT"
echo "MCP Endpoint: $ENDPOINT/mcp"
echo "Health Check: $ENDPOINT/health"
