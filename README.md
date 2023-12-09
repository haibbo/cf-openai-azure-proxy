# cf-openai-azure-proxy

<a href="./README_en.md">English</a> |
<a href="./README.md">中文</a>

> 大多数 OpenAI 客户端不支持 Azure OpenAI Service，但Azure OpenAI Service的申请和绑卡都非常简单，并且还提供了免费的额度。此脚本使用免费的 Cloudflare Worker 作为代理，使得支持 OpenAI 的客户端可以直接使用 Azure OpenAI Service。

### 支持模型:
- GPT-3
- GPT-4
- DALL-E-3
  
模型子类添加非常容易, 参考下面的使用说明
  
### 项目说明:
- 我没有服务器可以使用吗?
    - 这段脚本跑在Cloudflare Worker, 不需要服务器, 不需要绑卡, 每天10W次请求 免费
- 我没有自己的域名可以使用吗?
    - 也可以, 参考: https://github.com/haibbo/cf-openai-azure-proxy/issues/3
- 实现打印机模式：
    - Azure OpenAI Service's 回复是一段一段回复的
    - 返回给客户端的时候， 本项目拆出一条条的消息, 依次给， 达到打印机模式
- 项目也支持 Docker 部署（基于 wrangler）

### 部署
代理 OpenAI 的请求到 Azure OpenAI Serivce，代码部署步骤：

1. 注册并登录到 Cloudflare 账户
2. 创建一个新的 Cloudflare Worker
3. 将 [cf-openai-azure-proxy.js](./cf-openai-azure-proxy.js) 复制并粘贴到 Cloudflare Worker 编辑器中
4. 通过修改或环境变量调整 resourceName 和 deployment mapper 的值
5. 保存并部署 Cloudflare Worker
6. https://github.com/haibbo/cf-openai-azure-proxy/issues/3 **可选**绑定自定义域名: 在 Worker 详情页 -> Trigger -> Custom Domains 中为这个 Worker 添加一个自定义域名


### 使用说明

先得到 resourceName 和 deployment mapper, 登录到Azure的后台:

<img width="777" src="https://user-images.githubusercontent.com/1295315/233124125-1ea95665-ffab-4b5c-a7ba-26f31f1bb0b3.png" alt="env" />

#### 这里有两种做法:
- 直接修改他们的值, 如:
```js
// The name of your Azure OpenAI Resource.
const resourceName="codegpt"

// deployment model mapper
const mapper = {
     'gpt-3.5-turbo': 'gpt3',
     'gpt-4': 'gpt4',
     'dall-e-3': 'dalle3' 
   };
其他的map规则直接按这样的格式续写即可
```
- 或者通过 cloudflare worker 控制台, 进入 Workers script > Settings > Add variable under Environment Variables.

  <img width="777" src="https://user-images.githubusercontent.com/1295315/233384224-aa6581f0-26a4-49cf-ae25-4dfb466143da.png" alt="env" />

### 客户端
以 OpenCat 为例: 自定义 API 域名填写 第六步绑定的域名:

<img width="339" src="https://user-images.githubusercontent.com/1295315/229820705-ab2ad1d1-8795-4670-97b4-16a0f9fdebba.png" alt="opencat" />

我已经尝试了多种客户端, 如果遇到其他客户端有问题, 欢迎创建issue.
