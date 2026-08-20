export async function streamChatCompletion(messages) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(
    /\/$/,
    '',
  )
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

  if (!apiKey) {
    throw new Error('缺少 DEEPSEEK_API_KEY，请在 backend/.env 中配置')
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DeepSeek API 错误 ${response.status}: ${text}`)
  }

  if (!response.body) {
    throw new Error('DeepSeek 未返回可读流')
  }

  return response.body
}
