/**
 * 流式 Markdown 稳定化：解决「输出一半」与「输出完成」列表/代码块结构不一致。
 *
 * 业界做法（Streamdown remend / Comark autoClose / DeepSeek 等）：
 * 在解析前对半截语法做最小补全，并保证块级结构可被稳定识别。
 */

/** 未闭合的围栏代码块补上结尾 ``` */
function closeOpenFences(source: string): string {
  const fenceMatches = source.match(/^(`{3,})/gm)
  if (!fenceMatches) return source
  // 奇数个 fence 行 → 仍在代码块内
  if (fenceMatches.length % 2 === 1) {
    return `${source.replace(/\s*$/u, '')}\n\`\`\`\n`
  }
  return source
}

/**
 * 列表识别依赖「行」边界。半截输出若停在：
 *   - `1.` / `-` / `*` 后尚无正文
 *   - 或最后一行没有换行
 * 解析器会把后续 token 当成段落而非列表项，导致结构跳动。
 */
function stabilizeListBoundaries(source: string): string {
  let text = source
  if (!text.endsWith('\n')) {
    text += '\n'
  }

  // 末尾仅有列表标记、尚无条目正文时，先补占位空格，避免标记被吞成普通段落
  text = text.replace(
    /(^|\n)([-*+]|\d+[.)])[ \t]*\n$/u,
    (_m, prefix: string, marker: string) => `${prefix}${marker} \n`,
  )

  return text
}

export function stabilizeStreamingMarkdown(
  source: string,
  streaming: boolean,
): string {
  if (!source) return ''
  if (!streaming) return source

  let text = closeOpenFences(source)
  text = stabilizeListBoundaries(text)
  return text
}
