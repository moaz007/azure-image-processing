const { BlobServiceClient } = require('@azure/storage-blob');
const appInsights = require("applicationinsights");

// Initialize Application Insights if not already started.
if (!appInsights.defaultClient) {
  appInsights.start();
}
const telemetryClient = appInsights.defaultClient;

module.exports = async function (context, req) {
  // --- Track the start of the function ---
  telemetryClient.trackEvent({
    name: "FunctionStarted",
    properties: {
      functionName: "uploadImage",
      invocationId: context.invocationId,
      startTime: new Date().toISOString()
    }
  });

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

    // --- Create a client for the 'upload' container and upload the image ---
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('upload');
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    // Convert base64 image to buffer and upload with proper content type
    const buffer = Buffer.from(image, "base64");
    await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
    
    const execTime = Date.now() - startTime;
    context.log(`Upload Execution time: ${execTime}ms`);

    // --- Track the end of the function (success) ---
    telemetryClient.trackEvent({
      name: "FunctionEnded",
      properties: {
        functionName: "uploadImage",
        invocationId: context.invocationId,
        endTime: new Date().toISOString(),
        executionTime: execTime,
        status: "Success"
      }
    });

    context.res = {
      status: 200,
      body: { message: "Image uploaded successfully!", executionTime: execTime }
    };
  } catch (error) {
    context.log.error("Upload Error:", error.message);
    const execTime = Date.now() - startTime;

    // --- Track the end of the function (error) ---
    telemetryClient.trackEvent({
      name: "FunctionEnded",
      properties: {
        functionName: "uploadImage",
        invocationId: context.invocationId,
        endTime: new Date().toISOString(),
        executionTime: execTime,
        status: "Error",
        errorMessage: error.message
      }
    });

    context.res = { status: 500, body: { error: error.message } };
  }
};

