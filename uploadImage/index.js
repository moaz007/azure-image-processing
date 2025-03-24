const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  // Throttle simulation: check if a throttle should be simulated
if (req.query.simulateThrottle || (req.body && req.body.simulateThrottle)) {
  try {
    const appInsights = require('applicationinsights');
    const instrKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY;
    if (!instrKey) {
      context.log.warn("APPINSIGHTS_INSTRUMENTATIONKEY is not set.");
    }
    if (!appInsights.defaultClient) {
      appInsights.setup(instrKey || "").start();
    }
    appInsights.defaultClient.trackEvent({ 
      name: "ThrottleEvent", 
      properties: { functionName: "uploadImage" } 
    });
    // Flush telemetry to ensure it is sent before function exit.
    appInsights.defaultClient.flush({
      callback: () => {
        context.log("Telemetry flushed for throttle event.");
        context.res = { status: 429, body: "Throttled due to simulation." };
        context.done();  // Ensure function waits for flush.
      }
    });
    return; // Exit the function after scheduling the flush.
  } catch (telemetryError) {
    context.log.error("Error logging throttle event:", telemetryError.message);
  }
}


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
    context.res = { status: 500, body: { error: error.message } };
  }
};

