// The name of your Azure OpenAI Resource.
const resourceName="your-resource-name"

// The deployment name you chose when you deployed the model.
const deployName="deployment-name"

const apiVersion="2023-03-15-preview"


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
 
  const fetchAPI = `https://${resourceName}.openai.azure.com/openai/deployments/${deployName}/${path}?api-version=${apiVersion}`
  let body;
  if (request.method === 'POST') {
    body = await request.json();
  }
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

// Add new line
async function stream(readable, writable) {
  const reader = readable.getReader();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const newline = "\n";
  const encodedNewline = encoder.encode(newline);

  while (true) {
    let { value, done } = await reader.read();
    if (done) {
      break;
    }

    await writer.write(value);
  }
  await writer.write(encodedNewline);
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
