// The name of your Azure OpenAI Resource.
const resourceNames = {
  'gpt-4-1106-preview': RESOURCE_NAME_GPT4,
  'gpt-4-0613': RESOURCE_NAME_GPT4,
  'gpt-4-32k-0613': RESOURCE_NAME_GPT4,
  'gpt-4-0314': RESOURCE_NAME_GPT4,
  'gpt-4-32k-0314': RESOURCE_NAME_GPT4,
  'gpt-4-vision-preview': RESOURCE_NAME_GPT4,
  'gpt-3.5-turbo-1106': RESOURCE_NAME_GPT35,
  'gpt-3.5-instruct-0914': RESOURCE_NAME_GPT35,
  'gpt-3.5-turbo-0613': RESOURCE_NAME_GPT35,
  'gpt-3.5-turbo-16k-0613': RESOURCE_NAME_GPT35,
  'gpt-3.5-turbo-0301': RESOURCE_NAME_GPT35,
  'dall-e-3': RESOURCE_NAME_DALLE3,
  'gpt-4': RESOURCE_NAME_GPT4,
  'gpt-3.5-turbo': RESOURCE_NAME_GPT35,
};

// The resourceKey when you chose your Azure OpenAI Resource
const resourceKeys = {
  RESOURCE_NAME_GPT4: RESOURCE_KEY_GPT4,
  RESOURCE_NAME_GPT35: RESOURCE_KEY_GPT35,
  RESOURCE_NAME_DALLE3: RESOURCE_KEY_DALLE3,
};

// The deployment name you chose when you deployed the model.
const mapper = {
  'gpt-4-1106-preview': DEPOLY_NAME_GPT4,
  'gpt-4-0613': DEPOLY_NAME_GPT4,
  'gpt-4-32k-0613': DEPOLY_NAME_GPT4,
  'gpt-4-0314': DEPOLY_NAME_GPT4,
  'gpt-4-32k-0314': DEPOLY_NAME_GPT4,
  'gpt-4-vision-preview': DEPOLY_NAME_GPT4,
  'gpt-3.5-turbo-1106': DEPOLY_NAME_GPT35,
  'gpt-3.5-instruct-0914': DEPOLY_NAME_GPT35,
  'gpt-3.5-turbo-0613': DEPOLY_NAME_GPT35,
  'gpt-3.5-turbo-16k-0613': DEPOLY_NAME_GPT35,
  'gpt-3.5-turbo-0301': DEPOLY_NAME_GPT35,
  'dall-e-3': typeof DEPOLY_NAME_DALLE3 !== 'undefined' ? DEPOLY_NAME_DALLE3 : "dalle3",
  'gpt-4': DEPOLY_NAME_GPT4,
  'gpt-3.5-turbo': DEPOLY_NAME_GPT35,
};

const secretKey = SECRET_KEY; // Set your own secret key here

const apiVersion = "2023-12-01-preview";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return handleOPTIONS(request)
  }

  const url = new URL(request.url);
  if (url.pathname.startsWith("//")) {
    url.pathname = url.pathname.replace('/', "")
  }
  if (url.pathname === '/v1/chat/completions') {
    var path = "chat/completions"
  } else if (url.pathname === '/v1/completions') {
    var path = "completions"
  } else if (url.pathname === '/v1/models') {
    return handleModels(request)
  } else {
    return new Response('404 Not Found', { status: 404 })
  }

  let body;
  if (request.method === 'POST') {
    body = await request.json();
  }

  const modelName = body?.model;
  const deployName = mapper[modelName] || '';
  const resourceName = resourceNames[modelName] || '';

  // (optional) Convert image URL to Base64
  if (modelName == "gpt-4-vision-preview") {
    for (let message of body.messages) {
      for (let content of message.content) {
        if (content.type === 'image_url') {
          const imageUrl = content.image_url.url;

          if (!imageUrl.startsWith('data:')) {
            continue;
          }

          try {
            console.log(`Fetching image from URL: ${imageUrl}`);
            const imageResponse = await fetch(imageUrl);
            console.log(`Received response with status: ${imageResponse.status}`);

            if (imageResponse.ok) {
              const arrayBuffer = await imageResponse.arrayBuffer();
              console.log(`Image loaded, converting to Base64...`);
              const base64String = bufferToBase64(arrayBuffer);
              console.log(`Image converted to Base64: data:${imageResponse.headers.get('content-type')};base64,...`);
              content.image_url.url = `data:${imageResponse.headers.get('content-type')};base64,${base64String}`;
            } else {
              console.error(`Failed to fetch image. Status: ${imageResponse.status}`);
            }
          } catch (error) {
            console.error(`Error fetching image: ${error}`);
          }
        }
      }
    }
  }

  if (deployName === '' || resourceName === '') {
    return new Response('Missing model mapper or resource name', {
      status: 403
    });
  }
  const fetchAPI = `https://${resourceName}.openai.azure.com/openai/deployments/${deployName}/${path}?api-version=${apiVersion}`
  const authKey = request.headers.get('Authorization');
  if (!authKey || authKey !== 'Bearer ' + secretKey) {
    return new Response("Not allowed", {
      status: 403
    });
  }

  const payload = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "api-key": resourceKeys[resourceName],
    },
    body: typeof body === 'object' ? JSON.stringify(body) : '{}',
  };

  let response;
  try {
    response = await fetch(fetchAPI, payload);
    console.log(response);
  } catch (error) {
    return new Response('Error fetching API', { status: 500 });
  }

  if (body?.stream !== true) {
    return new Response(response.body, {
      status: response.status,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }

  let { readable, writable } = new TransformStream();
  stream(response.body, writable, body).catch((error) => {
    console.error('Stream error:', error);
  });
  return new Response(readable, {
    headers: { 'Access-Control-Allow-Origin': '*' }
  });
}

function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function stream(readable, writable, requestData) {
  const reader = readable.getReader();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  console.log("Start streaming...");

  async function push() {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer) {
        await processBuffer();
      }
      await writer.close();
      return;
    }
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;
    await processBuffer();
    push();
  }

  async function processBuffer() {
    const delimiter = "\n\n";
    const lines = buffer.split(delimiter);
    for (let i = 0; i < lines.length - 1; i++) {
      await processLine(lines[i]);
    }
    buffer = lines[lines.length - 1];
  }

  // Refine the data to match the OpenAI API
  async function processLine(line) {
    if (!line.startsWith("data: ")) return;
    const raw = line.substring(6);
    if (raw.startsWith("[DONE]")) {
      await writer.write(encoder.encode("data: [DONE]\n\n"));
      return;
    }
    try {
      let data = JSON.parse(raw);
      if (data.choices.length === 0 || !data.choices[0].delta)
        data.choices[0] = { delta: {} };
      if (data.choices[0].delta?.content === null)
        data.choices[0].delta.content = "";
      if (data.choices[0].finish_reason === undefined)
        data.choices[0].finish_reason = null;
      if (data.model === undefined && requestData.model !== undefined)
        data.model = requestData.model;
      if (data.object === undefined)
        data.object = "chat.completion.chunk";
      const to_send = `data: ${JSON.stringify(data)}\n\n`;
      console.log("Sending data: ", to_send);
      await writer.write(encoder.encode(to_send));
      await sleep(20);
    } catch (e) {
      console.error("Failed to parse JSON:", e);
    }
  }

  push();
}

async function handleModels(request) {
  const data = {
    "object": "list",
    "data": []
  };

  for (let key in mapper) {
    data.data.push({
      "id": key,
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai",
      "permission": [{
        "id": "modelperm-M56FXnG1AsIr3SXq8BYPvXJA",
        "object": "model_permission",
        "created": 1679602088,
        "allow_create_engine": false,
        "allow_sampling": true,
        "allow_logprobs": true,
        "allow_search_indices": false,
        "allow_view": true,
        "allow_fine_tuning": false,
        "organization": "*",
        "group": null,
        "is_blocking": false
      }],
      "root": key,
      "parent": null
    });
  }

  const json = JSON.stringify(data, null, 2);
  return new Response(json, {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleOPTIONS(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*'
    }
  })
}
