const { BlobServiceClient } = require('@azure/storage-blob');
const sharp = require('sharp');

let isColdStart = true;

module.exports = async function (context, req) {
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
    if (!connectionString) {
      throw new Error("AzureWebJobsStorage connection string is missing.");
    }
    context.log("Using storage connection string");

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlockBlobClient(fileName);
    context.log("Downloading blob...");
    const downloadResponse = await blobClient.download();
    const chunks = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    const imageBuffer = Buffer.concat(chunks);
    const downloadTime = Date.now() - overallStart;
    context.log(`Blob downloaded in ${downloadTime} ms`);

    const processStart = Date.now();
    context.log("Processing image with Sharp...");
    const processedBuffer = await sharp(imageBuffer)
      .resize(300, 300, { fit: "cover", position: "center" })
      .jpeg({ quality: 80 })
      .toBuffer();
    const processingTime = Date.now() - processStart;
    context.log(`Image processed in ${processingTime} ms`);

    const uploadStart = Date.now();
    const processedFileName = `processed-${fileName}`;
    context.log(`Processed file name: ${processedFileName}`);
    const processContainer = blobServiceClient.getContainerClient("process");
    const processedBlobClient = processContainer.getBlockBlobClient(processedFileName);
    context.log("Uploading processed image...");
    await processedBlobClient.uploadData(processedBuffer, { 
      blobHTTPHeaders: { blobContentType: "image/jpeg" } 
    });
    const uploadTime = Date.now() - uploadStart;
    context.log(`Processed image uploaded in ${uploadTime} ms`);

    const statusStart = Date.now();
    const statusContent = {
      message: "Image processed successfully!",
      processedKey: processedFileName,
      coldStart: coldStart,
      executionTime: null
    };
    const statusFileName = fileName.replace(/\.(\w+)$/, '-status.json');
    const statusBlobClient = processContainer.getBlockBlobClient(statusFileName);
    context.log(`Uploading status file: ${statusFileName}...`);
    await statusBlobClient.uploadData(Buffer.from(JSON.stringify(statusContent)), { 
      blobHTTPHeaders: { blobContentType: "application/json" } 
    });
    const statusTime = Date.now() - statusStart;
    context.log(`Status file uploaded in ${statusTime} ms`);

    const overallExecTime = Date.now() - overallStart;
    context.log(`Overall execution time: ${overallExecTime} ms, Cold start: ${coldStart}`);

    const memoryUsedMB = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    context.log(`Memory usage: ${memoryUsedMB} MB`);

    isColdStart = false;
    context.res = {
      status: 200,
      body: { 
        message: "Image processed successfully!", 
        processedKey: processedFileName, 
        coldStart: coldStart, 
        executionTime: overallExecTime 
      }
    };
  } catch (error) {
    context.log.error("Process Error:", error.message);

    // Log throttle event if HTTP 429 is detected
    if (error.statusCode === 429 || (error.message && error.message.includes("429"))) {
      context.log.warn("THROTTLE_EVENT: process, count: 1");
    }

    const overallExecTime = Date.now() - overallStart;
    context.res = { 
      status: 500, 
      body: { error: error.message, coldStart: coldStart, executionTime: overallExecTime } 
    };
  }
};

