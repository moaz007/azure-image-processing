#!/bin/bash
# bulk_upload.sh
# Usage: ./bulk_upload.sh <path_to_folder_of_images>

# Check if folder path is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <path_to_folder_of_images>"
  exit 1
fi

FOLDER_PATH="$1"

# Verify that the folder exists
if [ ! -d "$FOLDER_PATH" ]; then
  echo "Error: $FOLDER_PATH is not a valid directory."
  exit 1
fi

echo "Starting bulk upload from folder: $FOLDER_PATH"

# Loop through all files in the specified folder
for file in "$FOLDER_PATH"/*; do
  # Check if it's a file (not a directory) and likely an image
  if [ -f "$file" ] && [[ "$file" =~ \.(jpg|jpeg|png)$ ]]; then
    echo "----------------------------------------"
    echo "Processing file: $file"
    # Call your existing script to upload and process the image
    ./image_processing.sh "$file"
    echo "Finished processing: $file"
    echo "----------------------------------------"
  fi
done

echo "Bulk upload process completed!"

