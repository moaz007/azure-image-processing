const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');
const appInsights = require("applicationinsights");
if (!appInsights.defaultClient) appInsights.start();
const telemetryClient = appInsights.defaultClient;

let isColdStart = true;

module.exports = async function (context, req) {
  telemetryClient.trackEvent({ name: "FunctionStarted", properties: { functionName: "processimage", invocationId: context.invocationId, coldStart: isColdStart } });
  const overallStart = Date.now();
  const { containerName, fileName } = req.body;
  if (!containerName || !fileName) {
    context.log.error("Missing 'containerName' or 'fileName'");
    context.res = { status: 400, body: "Missing 'containerName' or 'fileName'" };
    return;
  }
  const coldStart = isColdStart;
  try {
    const connectionString = process.env.AzureWebJobsStorage;
    if (!connectionString) throw new Error("AzureWebJobsStorage connection string is missing.");
    context.log("Using storage connection string");
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(fileName);
    context.log("Downloading blob...");
    const downloadResponse = await blobClient.download();
    const chunks = [];
    for await (const chunk of downloadResponse.readableStreamBody) { chunks.push(chunk); }
    const imageBuffer = Buffer.concat(chunks);
    context.log(`Blob downloaded in ${Date.now() - overallStart} ms`);
    const processStart = Date.now();
    context.log("Processing image with Sharp...");
    const processedBuffer = await sharp(imageBuffer)
      .resize(300, 300, { fit: "cover", position: "center" })
      .jpeg({ quality: 80 })
      .toBuffer();
    context.log(`Image processed in ${Date.now() - processStart} ms`);
    const uploadStart = Date.now();
    const processedFileName = `processed-${fileName}`;
    context.log(`Processed file name: ${processedFileName}`);
    const processContainer = blobServiceClient.getContainerClient("process");
    const processedBlobClient = processContainer.getBlockBlobClient(processedFileName);
    context.log("Uploading processed image...");
    await processedBlobClient.uploadData(processedBuffer, { blobHTTPHeaders: { blobContentType: "image/jpeg" } });
    context.log(`Processed image uploaded in ${Date.now() - uploadStart} ms`);
    const statusStart = Date.now();
    const statusContent = { message: "Image processed successfully!", processedKey: processedFileName, coldStart: coldStart, executionTime: null };
    const statusFileName = fileName.replace(/\.(\w+)$/, '-status.json');
    const statusBlobClient = processContainer.getBlockBlobClient(statusFileName);
    context.log(`Uploading status file: ${statusFileName}...`);
    await statusBlobClient.uploadData(Buffer.from(JSON.stringify(statusContent)), { blobHTTPHeaders: { blobContentType: "application/json" } });
    context.log(`Status file uploaded in ${Date.now() - statusStart} ms`);
    const overallExecTime = Date.now() - overallStart;
    context.log(`Overall execution time: ${overallExecTime} ms, Cold start: ${coldStart}`);
    const memoryUsedMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    context.log(`Memory usage: ${memoryUsedMB} MB`);
    isColdStart = false;
    context.res = { status: 200, body: { message: "Image processed successfully!", processedKey: processedFileName, coldStart: coldStart, executionTime: overallExecTime } };
    telemetryClient.trackEvent({ name: "FunctionEnded", properties: { functionName: "processimage", invocationId: context.invocationId, executionTime: overallExecTime, coldStart: coldStart, status: "Success" } });
  } catch (error) {
    context.log.error("Process Error:", error.message);
    const overallExecTime = Date.now() - overallStart;
    telemetryClient.trackEvent({ name: "FunctionEnded", properties: { functionName: "processimage", invocationId: context.invocationId, executionTime: overallExecTime, coldStart: coldStart, status: "Error", errorMessage: error.message } });
    context.res = { status: 500, body: { error: error.message, coldStart: coldStart, executionTime: overallExecTime } };
  }
};

