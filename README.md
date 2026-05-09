# Chiikawa Badminton Board

一个双页面站点：
- `/`：炫酷移动端博客首页
- `/badminton/`：移动端优先的羽毛球接龙解析与场地分配工具

## 功能

- 粘贴微信群接龙文本，自动提取日期、星期、时间、地点、局别和名单
- 识别女生标记（`🌷/💐/🌸`）与等级文本（如 `中羽3.5级`、`台羽4级`）
- 待分配成员可拖拽到场地（桌面端）或先点成员再点场地（手机端）
- 导出当前排表为 JSON 文件
- 预留“生成图片”API按钮（后续接入大模型）

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

构建产物位于 `dist/`，默认 `base=/`。

## 部署到 `wangxinfeng.com/badminton`

1. 将 `dist/` 全部内容上传到网站根目录。
2. 访问 `https://wangxinfeng.com/` 验证博客首页。
3. 点击顶部 `🏸 羽毛球图表` 进入 `https://wangxinfeng.com/badminton/`。

## 预留 API

- 按钮“生成排表图片(预留API)”目前仅占位。
- 建议后续实现 `POST /api/render`，入参为当前排表 JSON，返回生成图片下载链接。
