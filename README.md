# cf-openai-azure-proxy

> 大多数 OpenAI 客户端不支持 Azure OpenAI Service，但Azure OpenAI Service的申请和绑卡都非常简单，并且还提供了免费的额度。此脚本使用免费的 Cloudflare Worker 作为代理，使得支持 OpenAI 的客户端可以直接使用 Azure OpenAI Service。



代理 OpenAI 的请求到 Azure OpenAI Serivce，代码部署步骤：

1. 注册并登录到 Cloudflare 账户
2. 创建一个新的 Cloudflare Worker
3. 将 [cf-openai-azure-proxy.js](./cf-openai-azure-proxy.js) 复制并粘贴到 Cloudflare Worker 编辑器中
4. 修改对应的 resourceName 和 deployName
5. 保存并部署 Cloudflare Worker
6. https://github.com/haibbo/cf-openai-azure-proxy/issues/3 **可选**绑定自定义域名: 在 Worker 详情页 -> Trigger -> Custom Domains 中为这个 Worker 添加一个自定义域名

### 使用说明

第四步中的 resourceName 和 deployName, 必须要选对, 登录到Azure的后台:

![azure](https://user-images.githubusercontent.com/1295315/229705215-e0556c99-957f-4d98-99a6-1c51254110b9.png)

### 客户端 
以 OpenCat 为例: 自定义 API 域名填写 第六步绑定的域名:

<img width="339" src="https://user-images.githubusercontent.com/1295315/229820705-ab2ad1d1-8795-4670-97b4-16a0f9fdebba.png" alt="opencat" />

我已经尝试了多种客户端, 如果遇到其他客户端有问题, 欢迎创建issue.

QA:
- 我没有服务器可以使用吗?
  - 这段脚本跑在Cloudflare Worker, 不需要服务器, 不需要绑卡, 每天10W次请求 免费
- 我没有自己的域名可以使用吗?
  - 也可以, 参考: https://github.com/haibbo/cf-openai-azure-proxy/issues/3
