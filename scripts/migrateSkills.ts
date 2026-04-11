import fs from 'fs/promises';
import path from 'path';
import yaml from 'yaml';

// 配置区
const MINIMAX_API_KEY = 'sk-cp-yRIIpUY_9y9nop4d51Qm_yNt5uU1vy9uBZu73t17V8r8pPJCv36mzoVTHHshP2eXtMiQT-7dbfXGfOvm-mifue6i4ItrpD91YOY8TbU0mMkp3UXzk_wg81Q';
const MINIMAX_MODEL = 'codingplan';
const MINIMAX_API_URL = 'https://api.minimaxi.chat/v1/text/chatcompletion_v2';

const SOURCE_DIRS = ['./skiils-line'];
const DEST_DIR = './.claude/skills';

// MiniMax 抽取元数据函数
async function extractMetadataWithLLM(content: string) {
  const prompt = `您是一个专业的代码分析器。下面是一段现有的 Claude Code Skill prompt / Markdown 内容。请帮我分析这段内容，以 JSON 格式输出它的元信息：
1. \`name\`: 给这个技能起个不超过 3 个单词的名字（纯英文小写短杠连接，如 react-debugger）
2. \`description\`: 一句话总结它能干什么。
3. \`domain\`: 从 [frontend, backend, infra, data, general] 中选择最合适的一个。如果不确定可以选 general。
4. \`scene\`: 从 [debug, review, refactor, release, test, architecture, none] 中选择一个（如果没有强烈特征选 none）。
5. \`requiredTools\`: 推测它需要什么底层工具（根据文本内容如果提到终端则需要 [Bash]，修改文件需要 [Edit]，如果只回答问题则为空 []）。

内容如下：
---
${content.slice(0, 1500)} // 截断避免有些文件过长超限
---

请严格只返回可以被 JSON.parse 解析的字符串格式，不要包含 \`\`\`json 标签。`;

  try {
    const response = await fetch(MINIMAX_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: [{ role: 'user', content: prompt }],
      })
    });

    if (!response.ok) {
      throw new Error(`MiniMax API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    let reply = data.choices[0].message.content.trim();
    // 兼容有些大模型喜欢加 ```json 标签
    if (reply.startsWith('\`\`\`json')) {
      reply = reply.replace(/^\`\`\`json/m, '').replace(/\`\`\`$/m, '').trim();
    }
    
    return JSON.parse(reply);
  } catch (error) {
    console.error(`解析大模型返回失败 (可能因限流或返回非 json):`, error);
    return null; // 若失败，则返回 null，后续做默认处理
  }
}

// 递归查找所有的 md 文件
async function findAllMdFiles(dir: string, fileList: string[] = []): Promise<string[]> {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    // 忽略一些系统目录和不相关目录
    if (file.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.git')) {
      await findAllMdFiles(filePath, fileList);
    } else if (file.isFile() && filePath.endsWith('.md')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

// 核心执行方法
async function main() {
  console.log(`🚀 开始扫描旧版本技能文件...`);
  
  let allFiles: string[] = [];
  // 查找源文件夹
  for (const srcDir of SOURCE_DIRS) {
    try {
      allFiles = await findAllMdFiles(srcDir, allFiles);
    } catch(e) {
      console.warn(`扫描目录 ${srcDir} 失败 (可能不存在)`);
    }
  }

  console.log(`📦 找到 ${allFiles.length} 个 .md 文件。开始向 MiniMax 发起元数据推测...`);
  
  // 按照批次或串行请求，防止被大模型 API 并发限流
  let successCount = 0;
  for (const file of allFiles) {
    console.log(`⏳ 正在处理: ${file}`);
    const rawContent = await fs.readFile(file, 'utf-8');
    
    // 过滤掉本身已经有 Frontmatter 的文件 或者 纯粹是 README.md 的无关文件
    if (rawContent.startsWith('---') || file.toLowerCase().endsWith('readme.md')) {
        console.log(`⏭️  跳过已格式化或可能是说明文档的文件: ${file}`);
        continue;
    }

    let meta = await extractMetadataWithLLM(rawContent);

    // 如果接口请求失败或解析失败，给一个 fallback 兜底
    if (!meta) {
        meta = {
            name: `unnamed-skill-${Date.now().toString().slice(-4)}`,
            description: "No description generated due to LLM error",
            domain: "general",
            scene: "none",
            requiredTools: []
        };
    }

    // 注入评测强相关的强治理状态和安全底线
    meta.reviewState = "review";  // 强制进入待审区
    meta.trustLevel = "draft";    // 不视为可信
    
    // 生成新的 Yaml 头
    const frontmatter = `---\n${yaml.stringify(meta)}---\n\n`;
    const newContent = frontmatter + rawContent;

    // 清洗 name 使其合法
    const skillSlug = (meta.name || `unknown-${Math.random().toString(36).substring(7)}`).toLowerCase().replace(/[^a-z0-9\-]/g, '-');
    const destFolder = path.join(DEST_DIR, skillSlug);

    // 创建对应目标文件夹
    await fs.mkdir(destFolder, { recursive: true });
    
    // 写入新目录
    const destPath = path.join(destFolder, 'SKILL.md');
    await fs.writeFile(destPath, newContent, 'utf-8');
    
    successCount++;
    console.log(`✅ 成功落盘: -> ${destPath}`);
    
    // 适当等待防止限流
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`🎉 迁移完成！共成功重构了 ${successCount} 个 Skill。`);
}

main().catch(console.error);
