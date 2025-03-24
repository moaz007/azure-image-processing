const { BlobServiceClient } = require('@azure/storage-blob');

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

    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('upload');
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

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

    // Log a special message if a throttle error (HTTP 429) is detected
    if (error.statusCode === 429 || (error.message && error.message.includes("429"))) {
      context.log.warn("THROTTLE_EVENT: upload, count: 1");
    }
    context.res = { status: 500, body: { error: error.message } };
  }
};

