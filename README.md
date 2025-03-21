# Serverless Image Processing API

This project is a serverless image processing API built with Node.js (v20.19.0) using Azure Functions and Azure Blob Storage. It leverages Azure Functions for running HTTP‑triggered functions, along with GitHub Actions for automated continuous integration and deployment.

The API accepts a base64‑encoded image and file name in a JSON payload, processes the image (resizes it to 300×300 pixels and converts it to JPEG), and stores both the original and processed images in separate Blob Storage containers.

This repository contains all the configuration and scripts needed to deploy the project on Azure and demonstrates a modern, automated CI/CD workflow.

Muhammad Moaz Amin
