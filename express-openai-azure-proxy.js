/**
 * type in package.json must be module
 * 请将 package.json 中的 type 设置为 module
 * 
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

import express from 'express';
import fetch from 'node-fetch';
import { Transform } from 'stream';
import { TextDecoder, TextEncoder } from 'util';

const app = express();
const port = process.env.PORT || 3000;

const resourceName = 'Your Resource Name'; // change to your resource name

const mapper = {
  'gpt-3.5-turbo': 'gpt-35-turbo', // change to your deployment name
  'gpt-3.5-turbo-16k': 'gpt-35-turbo-16k', // change to your deployment name
  // 'gpt-4': DEPLOY_NAME_GPT4
};

/**
 * Returns the deployment name for a given model name.
 * 返回给定模型名称的部署名称。
 * 
 * @param {string} name - The name of the model.
 * @returns {string} The deployment name for the given model name.
 */
const getModelDeployName = (name) => mapper[name] || 'gpt-35-turbo-16k' // please change to your deployment name

const apiVersion = '2023-05-15'; // change api version if needed

app.use(express.json());

/**
 * Proxies requests to the /chat/completions endpoint of the OpenAI API.
 * 将请求代理到 OpenAI API 的 /chat/completions 端点。
 */
app.all('/v1/chat/completions', async (req, res) => {
  const fetchAPI = getFetchAPI(req, '/chat/completions');
  const response = await fetch(fetchAPI, getPayload(req, res));
  handleResponse(req, res, response);
});

/**
 * Proxies requests to the /completions endpoint of the OpenAI API.
 * 将请求代理到 OpenAI API 的 /completions 端点。
 */
app.all('/v1/completions', async (req, res) => {
  const fetchAPI = getFetchAPI(req, '/completions');
  const response = await fetch(fetchAPI, getPayload(req, res));
  handleResponse(req, res, response);
});

/**
 * Returns a list of available models.
 * 返回可用模型的列表。
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
 * Handles all other requests with a 404 Not Found response.
 * 用 404 Not Found 响应处理所有其他请求。
 */
app.all('*', (req, res) => {
  res.status(404).send('404 Not Found');
});

/**
 * Returns the fetch API URL for a given request and path.
 * 返回给定请求和路径的 fetch API URL。
 * 
 * @param {Object} req - The request object.
 * @param {string} path - The path to the API endpoint.
 * @returns {string} The fetch API URL for the given request and path.
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
 * Returns the payload for a given request and response.
 * 返回给定请求和响应的有效载荷。
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @returns {Object} The payload for the given request and response.
 */
function getPayload(req, res) {
  const authKey = req.headers.authorization;
  if (!authKey) {
    res.status(403).send('Not allowed');
  }

  return {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'api-key': authKey.replace('Bearer ', ''),
    },
    body: JSON.stringify(req.body) || '{}',
  };
}

/**
 * Handles the response from the OpenAI API and sends it to the client.
 * 处理来自 OpenAI API 的响应并将其发送到客户端。
 * 
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Object} response - The response from the OpenAI API.
 */
async function handleResponse(req, res, response) {
  const stream = new Transform({
    transform(chunk, encoding, callback) {
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();
      const newline = '\n';
      const delimiter = '\n\n';

      let buffer = '';
      buffer += decoder.decode(chunk, { stream: true });
      let lines = buffer.split(delimiter);

      for (let i = 0; i < lines.length - 1; i++) {
        this.push(encoder.encode(lines[i] + delimiter));
      }

      setTimeout(() => {
        callback();
      }, 20);
    },
  });

  response.body.pipe(stream);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  res.status(response.status);
  stream.pipe(res);
}

/**
 * Handles uncaught exceptions and logs them to the console.
 * 处理未捕获的异常并将其记录到控制台。
 */
process.on('uncaughtException', (err) => {
  console.error(err);
});

/**
 * Starts the server and listens on the specified port.
 * 启动服务器并监听指定的端口。
 */
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
