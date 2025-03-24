const { BlobServiceClient } = require('@azure/storage-blob');
const appInsights = require("applicationinsights");
if (!appInsights.defaultClient) appInsights.start();
const telemetryClient = appInsights.defaultClient;

module.exports = async function (context, req) {
  telemetryClient.trackEvent({ name: "FunctionStarted", properties: { functionName: "uploadImage", invocationId: context.invocationId } });
  const startTime = Date.now();
  const { image, fileName } = req.body;
  if (!image || !fileName) {
    context.res = { status: 400, body: "Missing image or fileName" };
    return;
  }
  try {
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) throw new Error("AzureWebJobsStorage connection string is missing.");
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('upload');
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);
    const buffer = Buffer.from(image, "base64");
    await blockBlobClient.uploadData(buffer, { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
    const execTime = Date.now() - startTime;
    context.log(`Upload Execution time: ${execTime}ms`);
    context.res = { status: 200, body: { message: "Image uploaded successfully!", executionTime: execTime } };
    telemetryClient.trackEvent({ name: "FunctionEnded", properties: { functionName: "uploadImage", invocationId: context.invocationId, executionTime: execTime, status: "Success" } });
  } catch (error) {
    context.log.error("Upload Error:", error.message);
    telemetryClient.trackEvent({ name: "FunctionEnded", properties: { functionName: "uploadImage", invocationId: context.invocationId, executionTime: Date.now() - startTime, status: "Error", errorMessage: error.message } });
    context.res = { status: 500, body: { error: error.message } };
  }
};

