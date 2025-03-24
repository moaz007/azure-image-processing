const { BlobServiceClient } = require('@azure/storage-blob');
const appInsights = require("applicationinsights");

// Initialize Application Insights if not already started.
if (!appInsights.defaultClient) {
  appInsights.start();
}
const telemetryClient = appInsights.defaultClient;

module.exports = async function (context, req) {
  // Track function start
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
    context.log.error("Missing image or fileName in request body");
    context.res = { status: 400, body: "Missing image or fileName" };
    return;
  }

  try {
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) {
      throw new Error("AzureWebJobsStorage connection string is missing.");
    }
    context.log("AzureWebJobsStorage connection string is available.");

    // Create a client for the 'upload' container
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('upload');
    
    // Check if container exists; if not, create it.
    const containerExists = await containerClient.exists();
    context.log(`Container 'upload' exists: ${containerExists}`);
    if (!containerExists) {
      context.log.error("Container 'upload' does not exist. Creating container...");
      await containerClient.create();
      context.log("Container 'upload' created successfully.");
    }

    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    // Convert base64 image to buffer and upload with proper content type
    const buffer = Buffer.from(image, "base64");
    await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
    
    const execTime = Date.now() - startTime;
    context.log(`Upload Execution time: ${execTime}ms`);

    // Track function end (success)
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
    context.log.error("Upload Error:", error);
    const execTime = Date.now() - startTime;

    // Track function end (error)
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

