# Contributing to Trove AI

感谢你对 Trove AI 感兴趣!以下是协作约定。

## 提 Issue

- **Bug**:复现步骤 + 期望行为 + 实际行为 + 环境(OS / Docker 版本 / 浏览器)
- **Feature**:先说清楚解决什么问题、谁会用、做完长什么样;不必有完整设计
- **Question**:用 GitHub Discussions,不是 Issue

## 提 PR

1. Fork → 起一个 feature 分支(`feat/xxx` / `fix/xxx`)
2. **先开 Issue 讨论**再写大块代码,避免做完不被合并
3. 保持单一职责:一个 PR 解决一件事
4. 描述里说明:
   - 改了什么
   - 为什么这么改
   - 怎么测的(截图 / curl / unit test 任选)

## 本地开发

```bash
# 后端
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev          # 默认 :3000
```

或者整个栈用 Docker:`docker compose up -d`,改文件后重启对应容器即可。

## 代码风格

- **Python**:遵循 PEP 8;函数文档说明意图(*为什么*)而不是逐行复述
- **TypeScript**:`strict: true`,组件 props 都有显式类型
- **不要**为了让 linter 通过就大段重命名/格式化别人代码 —— 一次只改自己要改的

## 提交信息

中文 / 英文均可,简短描述本次改动。例:
```
feat(sync): 支持图片本地化下载
fix(articles): 抖音抓取在 Playwright 加载完成前提前 return 的 bug
```

## 安全漏洞

请勿在公开 Issue 里讨论安全问题。直接邮件给维护者(地址见 GitHub 主页)。

## License

提交的代码默认按 [AGPL-3.0](LICENSE) 授权。
