// The name of your Azure OpenAI Resource for GPT-3.5 and GPT-4.
const resourceNameGPT35 = RESOURCE_NAME_GPT35;
const resourceNameGPT4 = RESOURCE_NAME_GPT4;

// The deployment name you chose when you deployed the model for GPT-3.5 and GPT-4.
const deployNameGPT35 = DEPLOY_NAME_GPT35;
const deployNameGPT4 = DEPLOY_NAME_GPT4;

const apiVersion = "2023-03-15-preview";

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return handleOPTIONS(request)
  }

  const url = new URL(request.url);
  if (url.pathname === '/v1/chat/completions') {
    var path="chat/completions"
  } else if (url.pathname === '/v1/completions') {
    var path="completions"
  } else if (url.pathname === '/v1/models') {
    return handleModels(request)
  } else {
    return new Response('404 Not Found', { status: 404 })
  }
 
  
  let body;
  if (request.method === 'POST') {
    body = await request.json();
  }
  const modelName = body && body.model ? body.model : "gpt-3.5-turbo";
  const { resourceName, deployName } = getModelMapper(modelName);

  const fetchAPI = `https://${resourceName}.openai.azure.com/openai/deployments/${deployName}/${path}?api-version=${apiVersion}`
  
  const authKey = request.headers.get('Authorization');
  if (!authKey) {
    return new Response("Not allowed", {
      status: 403
    });
  }

  const payload = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
      "api-key": authKey.replace('Bearer ', ''),
    },
    body: typeof body === 'object' ? JSON.stringify(body) : '{}',
  };

  let { readable, writable } = new TransformStream()
  const response = await fetch(fetchAPI, payload);
  stream(response.body, writable);
  return new Response(readable, response);

}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getModelMapper(model) {
  if (model === "gpt-3.5-turbo") {
    return { resourceName: resourceNameGPT35, deployName: deployNameGPT35 };
  } else if (model === "gpt-4") {
    return { resourceName: resourceNameGPT4, deployName: deployNameGPT4 };
  } else {
    throw new Error("Invalid model specified");
  }
}

// support printer mode and add newline
async function stream(readable, writable) {
  const reader = readable.getReader();
  const writer = writable.getWriter();

  // const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
// let decodedValue = decoder.decode(value);
  const newline = "\n";
  const delimiter = "\n\n"
  const encodedNewline = encoder.encode(newline);

  let buffer = "";
  while (true) {
    let { value, done } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true }); // stream: true is important here,fix the bug of incomplete line
    let lines = buffer.split(delimiter);

    // Loop through all but the last line, which may be incomplete.
    for (let i = 0; i < lines.length - 1; i++) {
      await writer.write(encoder.encode(lines[i] + delimiter));
      await sleep(30);
    }

    buffer = lines[lines.length - 1];
  }

  if (buffer) {
    await writer.write(encoder.encode(buffer));
  }
  await writer.write(encodedNewline)
  await writer.close();
}

async function handleModels(request) {
  const data = {
    "object": "list",
    "data": [ {
      "id": "gpt-3.5-turbo",
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
      "root": "gpt-3.5-turbo",
      "parent": null
    }]
  };
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