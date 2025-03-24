const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, req) {
  // Throttle simulation: check if a throttle should be simulated
  if (req.query.simulateThrottle || (req.body && req.body.simulateThrottle)) {
    // Initialize Application Insights if not already done
    const appInsights = require('applicationinsights');
    if (!appInsights.defaultClient) {
      appInsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY).start();
    }
    appInsights.defaultClient.trackEvent({ 
      name: "ThrottleEvent", 
      properties: { functionName: "uploadImage" } 
    });
    context.res = { status: 429, body: "Throttled due to simulation." };
    return;
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

