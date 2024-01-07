// The deployment name you chose when you deployed the model.
const chatmodel = 'text-generation';
const embeddmodel = 'embedding-001';

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return handleOPTIONS(request)
  }
  const url = new URL(request.url);
  if (url.pathname === '/v1/chat/completions' || url.pathname === '/v1/completions') {
    return handleRequestWithTransform(request, transformCommonRequest, transformCommonResponse);
  } else if (url.pathname === '/v1/embeddings') {
    return handleRequestWithTransform(request, transformEmbeddingRequest, transformEmbeddingResponse);
  } else {
    return new Response('404 Not Found for ' + url.pathname, { status: 404 })
  }
}

function transformURL(request) {
  const url = new URL(request.url);
  if (url.pathname === '/v1/chat/completions') {
    var path = "generation"
    var deployName = chatmodel;
  } else if (url.pathname === '/v1/completions') {
    var path = "generation"
    var deployName = chatmodel;
  } else if (url.pathname === '/v1/embeddings') {
    return null;
  } else {
    return null;
  }

  return `https://dashscope.aliyuncs.com/api/v1/services/aigc/${deployName}/${path}`
}

async function handleRequestWithTransform(request, transformRequestBody, transformResponseBody) {
  let body = await request.json();
  const fetchAPI = transformURL(request);
  // console.log(fetchAPI);

  if (fetchAPI === null) {
    return new Response('404 Not Found', { status: 404 })
  }

  const transformedBody = transformRequestBody(body);
  const payload = {
    method: request.method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': request.headers.get('Authorization')
    },
    body: JSON.stringify(transformedBody),
  };
  // console.log(payload);

  const response = await fetch(fetchAPI, payload);
  if (!response.ok) {
    return new Response(response.statusText, { status: response.status });
  }
  const response_data = await response.json();

  if(response_data?.code)
  {
    // 出现了错误，返回400
    return new Response(JSON.stringify(transformedBody) + '\n' + JSON.stringify(response_data) + '\n', {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*'
      },
      status: 400
    });
  }

  // console.log(response_data);

  const transformedResponse = transformResponseBody(response_data);
  // console.log(transformedResponse);

  if (body?.stream != true) {
    return new Response(JSON.stringify(transformedResponse), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*'
      }
    });
  } else {
    let { readable, writable } = new TransformStream();
    streamResponse(transformedResponse, writable);
    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*'
      }
    });
  }
}


// 现在 gemini 还不支持 function，所以这个函数暂时没用
function convert2GeminiFunctionDeclaration(tools, tool_choice) {
  if (tools === undefined || tool_choice === undefined || tool_choice === "none") {
    return [];
  }

  // TODO - add support for tool_choice

  const result = [];
  const functionDeclarations = [];

  for (const tool of tools) {
    if (tool.type === "function") {
      var functionDeclaration = {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
      };
      functionDeclarations.push(functionDeclaration);
    }
  }

  if (functionDeclarations.length > 0) {
    const toolObject = {
      functionDeclarations,
    };
    result.push(toolObject);
  }

  return result;
}

function transformEmbeddingRequest(body) {
  return {
    "model": "models/embedding-001",
    "content": {
      "parts": [
        {
          "text": body?.input
        }
      ]
    }
  };
}

function transformEmbeddingResponse(geminiData) {
  return {
    "object": "embedding",
    "embedding": geminiData?.embedding?.values || [],
    "index": 0
  };
}

function transformCommonRequest(openaiRequest) {

  var qwenRequest = {
    "model": openaiRequest.model.replace("gpt-3.5-turbo", "qwen-turbo"),
    "input": {
      "messages": openaiRequest.messages
    },
    "parameters": {
      "top_p": openaiRequest?.top_p,
      "top_k": openaiRequest?.candidateCount,
      "seed": openaiRequest?.seed,
    }
  };

  return qwenRequest;
}

// Function to transform the response
function transformCommonResponse(qwenResponse) {

  var openaiResponse = {
    "id": qwenResponse.request_id,
    "object": "chat.completion",
    "created": Math.floor(Date.now() / 1000),
    "model": "gpt-3.5-turbo-0613",
    "system_fingerprint": "fp_44709d6fcb",
    "choices": [{
      "index": 0,
      "message": {
        "role": "assistant",
        "content": qwenResponse.output.text,
      },
      "logprobs": null,
      "finish_reason": "stop"
    }],
    "usage": {
      "prompt_tokens": qwenResponse?.usage.input_tokens,
      "completion_tokens": qwenResponse?.usage.output_tokens,
      "total_tokens": qwenResponse?.usage.input_tokens + qwenResponse?.usage.output_tokens
    }
  };

  return openaiResponse;
}


function streamResponse(response, writable) {
  let encoder = new TextEncoder();
  let writer = writable.getWriter();

  let content = response.choices[0].message.content;

  let chunks = content.split("\n\n") || [];
  chunks.forEach((chunk, i) => {
    let chunkResponse = {
      ...response,
      object: "chat.completion.chunk",
      choices: [{
        index: response.choices[0].index,
        delta: { ...response.choices[0].message, content: chunk },
        finish_reason: i === chunks.length - 1 ? 'stop' : null // Set 'stop' for the last chunk
      }],
      usage: null
    };

    writer.write(encoder.encode(`data: ${JSON.stringify(chunkResponse)}\n\n`));
  });

  // Write the done signal
  writer.write(encoder.encode(`data: [DONE]\n`));

  writer.close();
}



async function handleOPTIONS(request) {
  return new Response("pong", {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*'
    }
  })
}
