#!/bin/bash
# Deploy to Google Cloud Run
set -e

PROJECT_ID="${GCP_PROJECT_ID:-agent-assemble-end-game}"
REGION="${GCP_LOCATION:-us-central1}"
SERVICE_NAME="clinical-promise-keeper"
IMAGE="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "Building container image..."
gcloud builds submit --tag "$IMAGE" --project "$PROJECT_ID"

echo "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project "$PROJECT_ID" \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=$REGION,GEMINI_MODEL=${GEMINI_MODEL:-gemini-3.1-flash-lite-preview}" \
  --timeout 300

echo "Deployment complete!"
ENDPOINT=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')
echo "Service URL: $ENDPOINT"
echo "MCP Endpoint: $ENDPOINT/mcp"
echo "Health Check: $ENDPOINT/health"
