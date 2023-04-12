# cf-openai-azure-proxy

<a href="./README_en.md">English</a> |
<a href="./README.md">中文</a>

> Most OpenAI clients do not support Azure OpenAI Service, but the application for Azure OpenAI Service is very simple, and it also provides free quotas. This script uses a free Cloudflare Worker as a proxy, allowing OpenAI-supported clients to directly use Azure OpenAI Service.

This script proxies requests to Azure OpenAI Service for OpenAI clients. The code deployment steps are as follows:

Register and log in to your Cloudflare account.
- Create a new Cloudflare Worker.
- Copy and paste cf-openai-azure-proxy.js into the Cloudflare Worker editor.
- Modify the corresponding "resourceName" and "mapper".

  **Mapper configuration example**: If you have deployed the GPT-3.5 Turbo and GPT-4 models on Azure with deployment names 'gpt35' and 'gpt4', respectively, then the mapper should be configured as follows.
  ```
  const mapper:any = {
    'gpt-3.5-turbo': 'gpt35',
    'gpt-4': 'gpt4' 
  };
  ```
   Other map rules can be continued directly in this format.
- Save and deploy the Cloudflare Worker.
- https://github.com/haibbo/cf-openai-azure-proxy/issues/3 Optional: Bind a custom domain name: Add a custom domain name for this worker in the Worker details page -> Trigger -> Custom Domains.

## Instructions
For step 4, resourceName and deployName must be selected correctly. Log in to the Azure backend:

## Client
Take OpenCat as an example: fill in the custom API domain name with the domain name bound in step 6:

<img width="339" src="https://user-images.githubusercontent.com/1295315/229820705-ab2ad1d1-8795-4670-97b4-16a0f9fdebba.png" alt="opencat" />
I have tried multiple clients. If you encounter problems with other clients, please feel free to create an issue.

QA:

- Do I need a server to use this?
  - This script runs on Cloudflare Worker and does not require a server or a bound card. It is free for up to 100,000 requests per day.
- Do I need my own domain name to use this?
  - No, it is not necessary. Refer to: https://github.com/haibbo/cf-openai-azure-proxy/issues/3
