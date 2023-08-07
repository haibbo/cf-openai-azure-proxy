/*!
 * This is the main file for the Azure GPT Proxy server.
 * 该文件是 Azure GPT 代理服务器的主文件。
 * 
 * It sets up an Express server that proxies requests to the OpenAI GPT API.
 * 它设置了一个 Express 服务器，将请求代理到 OpenAI GPT API。
 * 
 * The server listens on the specified port (default 3000) and proxies requests to the OpenAI API.
 * 服务器监听指定的端口（默认为 3000），并将请求代理到 OpenAI API。
 * 
 * The server also provides a /v1/models endpoint that returns a list of available models.
 * 服务器还提供了一个 /v1/models 端点，返回可用模型的列表。
 * 
 * @file This file contains the main server code.
 * @file 该文件包含主服务器代码。
 * @module index
 * @author ShinChven
 */

const express = require('express');
const axios = require('axios');
const { Transform, Readable } = require('stream');
const { TextDecoder, TextEncoder } = require('util');

const app = express();
const port = process.env.PORT || 3000;

const resourceName = 'openai'; // change to your resource name
// 资源名称，请更改为您的资源名称

const mapper = {
  'gpt-3.5-turbo': 'gpt-35-turbo', // change to your deployment name
  'gpt-3.5-turbo-16k': 'gpt-35-turbo-16k', // change to your deployment name
};
// 映射器，将模型名称映射到部署名称
// 请更改为您的映射器

const getModelDeployName = (name) => mapper[name] || 'gpt-35-turbo-16k';
// 获取模型的部署名称
// 请更改为您的部署名称

const apiVersion = '2023-05-15'; // change api version if needed
// API 版本，请根据需要更改

app.use(express.json());

/**
 * Handle requests to /v1/chat/completions endpoint
 * 处理 /v1/chat/completions 端点的请求
 */
app.all('/v1/chat/completions', async (req, res) => {
  const fetchAPI = getFetchAPI(req, '/chat/completions');
  const response = await axios(getPayload(req, res, fetchAPI));
  handleResponse(req, res, response);
});

/**
 * Handle requests to /v1/completions endpoint
 * 处理 /v1/completions 端点的请求
 */
app.all('/v1/completions', async (req, res) => {
  const fetchAPI = getFetchAPI(req, '/completions');
  const response = await axios(getPayload(req, res, fetchAPI));
  handleResponse(req, res, response);
});

/**
 * Handle requests to /v1/models endpoint
 * 处理 /v1/models 端点的请求
 */
app.all('/v1/models', async (req, res) => {
  const data = {
    object: 'list',
    data: [],
  };

  for (let key in mapper) {
    data.data.push({
      id: key,
      object: 'model',
      created: 1677610602,
      owned_by: 'openai',
      permission: [
        {
          id: 'modelperm-M56FXnG1AsIr3SXq8BYPvXJA',
          object: 'model_permission',
          created: 1679602088,
          allow_create_engine: false,
          allow_sampling: true,
          allow_logprobs: true,
          allow_search_indices: false,
          allow_view: true,
          allow_fine_tuning: false,
          organization: '*',
          group: null,
          is_blocking: false,
        },
      ],
      root: key,
      parent: null,
    });
  }

  const json = JSON.stringify(data, null, 2);
  res.setHeader('Content-Type', 'application/json');
  res.send(json);
});

/**
 * Handle all other requests
 * 处理所有其他请求
 */
app.all('*', (req, res) => {
  res.status(404).send('404 Not Found');
});

/**
 * Get the API endpoint URL for the given request
 * 获取给定请求的 API 端点 URL
 * @param {Object} req - The request object
 * @param {string} path - The path to the endpoint
 * @returns {string} - The API endpoint URL
 */
function getFetchAPI(req, path) {
  const modelName = req.body?.model;
  const deployName = getModelDeployName(modelName);

  if (deployName === '') {
    res.status(403).send('Missing model mapper');
  }

  return `https://${resourceName}.openai.azure.com/openai/deployments/${deployName}${path}?api-version=${apiVersion}`;
}

/**
 * Get the payload for the given request
 * 获取给定请求的有效载荷
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @param {string} url - The API endpoint URL
 * @returns {Object} - The request payload
 */
function getPayload(req, res, url) {
  const authKey = req.headers.authorization;
  if (!authKey) {
    res.status(403).send('Not allowed');
  }

  return {
    method: req.method,
    url,
    headers: {
      'Content-Type': 'application/json',
      'api-key': authKey.replace('Bearer ', ''),
    },
    data: JSON.stringify(req.body) || '{}',
    responseType: 'stream',
  };
}

/**
 * Handle the response from the API
 * 处理来自 API 的响应
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @param {Object} axiosResponse - The response from the API
 */
async function handleResponse(req, res, axiosResponse) {
  // Set headers and status
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(axiosResponse.status);

  // Pipe the response stream directly into the response
  axiosResponse.data.pipe(res);
}

/**
 * Handle uncaught exceptions
 * 处理未捕获的异常
 */
process.on('uncaughtException', (err) => {
  console.error(err);
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
