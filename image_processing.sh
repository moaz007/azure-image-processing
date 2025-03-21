#!/bin/bash
# A script to test the Azure HTTP-triggered functions for image processing.
# Usage: ./image_processing.sh <path_to_image>

if [ -z "$1" ]; then
    echo "Usage: ./image_processing.sh <path_to_image>"
    exit 1
fi

IMAGE_PATH="$1"
FILE_NAME=$(basename "$IMAGE_PATH")

# Endpoints for the Azure Functions
UPLOAD_ENDPOINT="https://image-processing-function2.azurewebsites.net/api/uploadImage"
PROCESS_ENDPOINT="https://image-processing-function2.azurewebsites.net/api/processImage"

# Record the workflow start time in milliseconds
workflowStart=$(date +%s%3N)

echo "Uploading $FILE_NAME via Azure Function at $UPLOAD_ENDPOINT..."

TMP_PAYLOAD=$(mktemp)
BASE64_IMAGE=$(base64 -w 0 "$IMAGE_PATH")
cat > "$TMP_PAYLOAD" <<EOF
{"image": "$BASE64_IMAGE", "fileName": "$FILE_NAME"}
EOF

UPLOAD_RESPONSE=$(curl -s -X POST "$UPLOAD_ENDPOINT" \
  -H "Content-Type: application/json" \
  --data-binary @"$TMP_PAYLOAD")
rm "$TMP_PAYLOAD"

UPLOAD_MESSAGE=$(echo "$UPLOAD_RESPONSE" | jq -r '.message')
echo "Upload Response: $UPLOAD_MESSAGE"
if [ "$UPLOAD_MESSAGE" != "Image uploaded successfully!" ]; then
  echo "Upload failed. Response: $UPLOAD_RESPONSE"
  exit 1
fi

# Capture the upload execution time from the response (if provided)
UPLOAD_EXEC_TIME=$(echo "$UPLOAD_RESPONSE" | jq -r '.executionTime')

echo "Triggering image processing for $FILE_NAME via Azure Function at $PROCESS_ENDPOINT..."
PROCESS_RESPONSE=$(curl -s -X POST "$PROCESS_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{\"containerName\": \"upload\", \"fileName\": \"$FILE_NAME\"}")

PROCESS_MESSAGE=$(echo "$PROCESS_RESPONSE" | jq -r '.message')
PROCESSED_KEY=$(echo "$PROCESS_RESPONSE" | jq -r '.processedKey')
COLD_START=$(echo "$PROCESS_RESPONSE" | jq -r '.coldStart')
EXECUTION_TIME=$(echo "$PROCESS_RESPONSE" | jq -r '.executionTime')

if [ "$PROCESS_MESSAGE" == "Image processed successfully!" ]; then
  echo "Processing successful: Processed image saved as $PROCESSED_KEY."
  echo "Cold start: $COLD_START"
  echo "Processing Execution time: ${EXECUTION_TIME}ms"
else
  echo "Processing failed. Response: $PROCESS_RESPONSE"
  exit 1
fi

# Calculate the overall workflow execution time
workflowEnd=$(date +%s%3N)
totalWorkflowTime=$(( workflowEnd - workflowStart ))
echo "Overall workflow execution time: ${totalWorkflowTime}ms"
echo "Workflow completed successfully."

# Publish a custom event with key metrics to Application Insights
CURRENT_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat <<EOF > unified.json
[
  {
    "name": "Microsoft.ApplicationInsights.Event",
    "time": "$CURRENT_TIME",
    "iKey": "a8d826c0-fc8e-4ab3-ac78-125f0117a140",
    "data": {
      "baseType": "EventData",
      "baseData": {
        "name": "UnifiedWorkflowMetrics",
        "properties": {
          "uploadExec": "$UPLOAD_EXEC_TIME",
          "processExec": "$EXECUTION_TIME",
          "coldStart": "$COLD_START",
          "totalWorkflowTime": "${totalWorkflowTime}ms"
        }
      }
    }
  }
]
EOF

RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d @unified.json "https://dc.services.visualstudio.com/v2/track")

