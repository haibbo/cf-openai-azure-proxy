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

  // if(body?.stream === true) {
  //   path = "streamGenerateContent";
  // }

  const authKey = request.headers.get('Authorization');
  if (!authKey) {
    return new Response("Not allowed", { status: 403 });
  }

  // Remove 'Bearer ' from the start of authKey
  const apiKey = authKey.replace('Bearer ', '');

  const fetchAPI = `https://generativelanguage.googleapis.com/v1/models/${deployName}:${path}?key=${apiKey}`

  // Transform request body from OpenAI to Gemini format
  const transformedBody = {
    // body?.messages 是一个数组，每个元素是一个对象，包含 role 和 content 两个属性
    // 目标是把这个数组转换成 {} 
    // if role is 'system', then delete the message 

    contents: body?.messages?.filter((message) => message.role !== 'system').map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: { text: message.content },
    })),

    generationConfig: {
      temperature: body?.temperature,
      candidateCount: body?.n,
      topP: body?.top_p,
    }
  };

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

  // if (body?.stream != true) 
  {
    const transformedResponse = transformResponse(geminiData);
    return new Response(JSON.stringify(transformedResponse), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*'
      }
    });
  }

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
