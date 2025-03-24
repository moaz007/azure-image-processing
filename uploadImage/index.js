const { BlobServiceClient } = require('@azure/storage-blob');
const appInsights = require("applicationinsights");

// Initialize Application Insights (ensure your APPINSIGHTS_INSTRUMENTATIONKEY is set in your environment)
if (!appInsights.defaultClient) {
  appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY).start();
}
const telemetryClient = appInsights.defaultClient;

module.exports = async function (context, req) {
  const startTime = Date.now();
  const { image, fileName } = req.body;

  if (!image || !fileName) {
    context.res = { status: 400, body: "Missing image or fileName" };
    return;
  }

  try {
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) {
      throw new Error("AzureWebJobsStorage connection string is missing.");
    }

    // Create a client for the 'upload' container and upload the image
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('upload');
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    // Convert base64 image to buffer and upload with proper content type
    const buffer = Buffer.from(image, "base64");
    await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
    
    const execTime = Date.now() - startTime;
    context.log(`Upload Execution time: ${execTime}ms`);

    context.res = {
      status: 200,
      body: { message: "Image uploaded successfully!", executionTime: execTime }
    };
  } catch (error) {
    context.log.error("Upload Error:", error.message);

    // Detect throttle error (HTTP 429) and log a custom telemetry event
    if (error.statusCode === 429 || (error.message && error.message.includes("429"))) {
      telemetryClient.trackEvent({
        name: "ThrottleEvent",
        properties: { FunctionName: "upload", ThrottleCount: 1 }
      });
    }

    context.res = { status: 500, body: { error: error.message } };
  }
};

