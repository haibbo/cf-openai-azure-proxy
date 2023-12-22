// The deployment name you chose when you deployed the model.
const chatmodel = 'gemini-pro';

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return handleOPTIONS(request)
  }



  const url = new URL(request.url);
  if (url.pathname === '/v1/chat/completions') {
    var path = "generateContent"
    var deployName = chatmodel;
  } else if (url.pathname === '/v1/completions') {
    var path = "generateContent"
    var deployName = chatmodel;
  } else {
    return new Response('404 Not Found', { status: 404 })
  }

  let body;
  if (request.method === 'POST') {
    body = await request.json();
  }

  const authKey = request.headers.get('Authorization');
  if (!authKey) {
    return new Response("Not allowed", { status: 403 });
  }

  // Remove 'Bearer ' from the start of authKey
  const apiKey = authKey.replace('Bearer ', '');

  const fetchAPI = `https://generativelanguage.googleapis.com/v1/models/${deployName}:${path}?key=${apiKey}`

  // Transform request body from OpenAI to Gemini format
  const transformedBody = transform2GeminiRequest(body);

  const payload = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(transformedBody),
  };

  const response = await fetch(fetchAPI, payload);

  // Check if the response is valid
  if (!response.ok) {
    return new Response(response.statusText, { status: response.status });
  }

  const geminiData = await response.json();

  // console.log(geminiData);

  // Transform response from Gemini to OpenAI format

  // console.log(transformedResponse);
  const transformedResponse = transformResponse(geminiData);

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

function transform2GeminiRequest(body) {

  let messages = body?.messages || [];
  if (messages.length === 0) {
    messages.push({ role: 'user', content: '' });
  } else {
    // 如果相邻的两个 message 的 role 相同，那么就把它们合并成一个 message
    let mergedMessages = [];
    let lastRole = null;
    messages.forEach((message) => {
      if (message.role === 'system') {
        message.role = 'user';
      } else if (message.role === 'assistant') {
        message.role = 'model';
      }

      if (lastRole === message.role) {
        mergedMessages[mergedMessages.length - 1].content += message.content + '\n';
      } else {
        mergedMessages.push(message);
      }
      lastRole = message.role;
    });

    messages = mergedMessages;
  }

  var ret = {
    // body?.messages 是一个数组，每个元素是一个对象，包含 role 和 content 两个属性
    // 目标是把这个数组转换成 {} 
    // if role is 'system', then delete the message 

    contents: messages.map(message => ({
      role: message.role,
      parts: { text: message.content },
    })),

    generationConfig: {
      temperature: body?.temperature,
      candidateCount: body?.n,
      topP: body?.top_p,
    }
  };

  console.log(ret);
  return ret;
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

// Function to transform the response
function transformResponse(GeminiData) {
  // Check if the 'candidates' array exists and if it's not empty
  if (!GeminiData.candidates) {
    // If it doesn't exist or is empty, create a default candidate message
    GeminiData.candidates = [
      {
        "content": {
          "parts": [
            {
              "text": "Oops, Model respond nothing."
            }
          ],
          "role": "model"
        },
        "finishReason": "STOP",
        "index": 0,
        "safetyRatings": [
          {
            "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            "probability": "NEGLIGIBLE"
          },
          {
            "category": "HARM_CATEGORY_HATE_SPEECH",
            "probability": "NEGLIGIBLE"
          },
          {
            "category": "HARM_CATEGORY_HARASSMENT",
            "probability": "NEGLIGIBLE"
          },
          {
            "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
            "probability": "NEGLIGIBLE"
          }
        ]
      }
    ];
  }

  // console.log(GeminiData.candidates);

  var ret = {
    id: "chatcmpl-QXlha2FBbmROaXhpZUFyZUF3ZXNvbWUK",
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000), // Current Unix timestamp
    model: 'gpt-3.5-turbo', // Static model name
    usage: {
      prompt_tokens: GeminiData.usageMetadata?.promptTokenCount, // This is a placeholder. Replace with actual token count if available
      completion_tokens: GeminiData.usageMetadata?.candidatesTokenCount, // This is a placeholder. Replace with actual token count if available
      total_tokens: GeminiData.usageMetadata?.totalTokenCount, // This is a placeholder. Replace with actual token count if available
    },
    choices: GeminiData.candidates.map((candidate) => ({
      message: {
        role: 'assistant',
        content: candidate.content.parts[0].text,
      },
      finish_reason: 'stop', // Static finish reason
      index: candidate.index,
    })),
  };

  return ret;
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
