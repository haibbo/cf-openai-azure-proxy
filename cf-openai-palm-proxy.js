// The deployment name you chose when you deployed the model.
const deployName = 'chat-bison-001';

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return handleOPTIONS(request)
  }

  const url = new URL(request.url);
  if (url.pathname === '/v1/chat/completions') {
    var path = "generateMessage"
  } else if (url.pathname === '/v1/completions') {
    var path = "generateText"
  } else {
    return new Response('404 Not Found', { status: 404 })
  }

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

  // Remove 'Bearer ' from the start of authKey
  const apiKey = authKey.replace('Bearer ', '');

  const fetchAPI = `https://generativelanguage.googleapis.com/v1beta2/models/${deployName}:${path}?key=${apiKey}`


  // Transform request body from OpenAI to PaLM format
  const transformedBody = {
    prompt: {
      messages: body?.messages?.map(msg => ({
        author: msg.role === 'user' ? '0' : '1',
        content: msg.content,
      })),
    },
  };

  const payload = {
    method: request.method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(transformedBody),
  };

  const response = await fetch(fetchAPI, payload);
  const palmData = await response.json();

  // Transform response from PaLM to OpenAI format
  const transformedResponse = transformResponse(palmData);

  if (body?.stream != true){
      return new Response(JSON.stringify(transformedResponse), {
        headers: {'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': '*',
                  'Access-Control-Allow-Headers': '*' }
      });
    } else {
      let { readable, writable } = new TransformStream();
      streamResponse(transformedResponse, writable);
      return new Response(readable, {
        headers: {'Content-Type': 'text/event-stream',  
                  'Access-Control-Allow-Origin': '*',
                  'Access-Control-Allow-Methods': '*',
                  'Access-Control-Allow-Headers': '*' }
      });
    }
}

function streamResponse(response, writable) {
  let encoder = new TextEncoder();
  let writer = writable.getWriter();

  let content = response.choices[0].message.content;

  // Split the content into chunks, and send each chunk as a separate event
  let chunks = content.match(/\s+|\S+/g) || [];
  chunks.forEach((chunk, i) => {
    let chunkResponse = {
      ...response,
      object: "chat.completion.chunk",
      choices: [{
        index: response.choices[0].index,
        delta: { ...response.choices[0].message, content: chunk },
        finish_reason: null
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
function transformResponse(palmData) {
  return {
    // id: 'chatcmpl-' + Math.random().toString(36).substring(2), // Generate a random id
    id: "chatcmpl-QXlha2FBbmROaXhpZUFyZUF3ZXNvbWUK",
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000), // Current Unix timestamp
    model: 'gpt-3.5-turbo', // Static model name
    usage: {
      prompt_tokens: palmData.messages.length, // This is a placeholder. Replace with actual token count if available
      completion_tokens: palmData.candidates.length, // This is a placeholder. Replace with actual token count if available
      total_tokens: palmData.messages.length + palmData.candidates.length, // This is a placeholder. Replace with actual token count if available
    },
    choices: palmData.candidates.map((candidate, index) => ({
      message: {
        role: 'assistant',
        content: candidate.content,
      },
      finish_reason: 'stop', // Static finish reason
      index: index,
    })),
  };
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
