---
title: "Hugo+Github 博客搭建"
date: 2023-06-24T20:30:21+08:00
draft: false
---

## 0. 这篇文章主要目的

记录使用`Hugo+Github`以及自己注册的域名，搭建一个简易博客，会尽可能给出详细步骤。

快速搭建，简单使用，后续再进行打磨，添加诸如标签，评论区，$\LaTeX$公式和导航条等等，当然，看的人多的话，也会考虑迁移到`WordPress`。

## 1. 前期准备工作

在自己的 Github 创建一个名为 `username.github.io`的公开仓库，其中`username`是自己账号的名称。在`Settings->Pages->Custom domain`中填写自己的域名，会在仓库中生成一个 CNAME 文件，完成后在自己电脑上`clone`下来。

如果是需要使用自己的域名的，还需要在域名服务商那边给域名添加解析：

```text
@ A 185.199.108.153
@ A 185.199.109.153
@ A 185.199.110.153
@ A 185.199.111.153
www CNAME username.github.io
```

相关文档：[管理 GitHub Pages 站点的自定义域](https://docs.github.com/zh/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)

## 2. Hugo 博客搭建

可以通过 Hugo 官网，根据自己的系统选择不同的安装方式，我的系统是 macOS：

```bash
# 1. macOS homebrew.
brew install hugo

# 2. use hugo command to create your blog folder,
# force option used when the folder name is already existing.
hugo new site blogfolder --force
cd blogfolder

# add theme
git submodule add https://github.com/theNewDynamic/gohugo-theme-ananke themes/ananke
echo "theme = 'ananke'" >> hugo.toml

# 3. view your website.
hugo server

# 4. create first post, then use markdown editor write your articles.
hugo new posts/HelloWorld.md

# 5. build
hugo server -D
# or "hugo server --buildDrafts"

# 6. deploy
hugo
```

还可以修改`hugo.toml`文件：

```text
# vim hugo.toml
baseURL = 'http://example.org/'
languageCode = 'en-us'
title = 'My New Hugo Site'
theme = 'ananke'
```

其中`baseURL`可以更换成自己的域名。

要注意，`Draft` 为 `True` 的文章是不会发布的。

至此，可以`git push`到远程仓库。

## 3. Hugo + Github Actions

在`Settings->Pagesz`中，将 `source` 改成 `Github Actions`，在本地创建文件 `.github/workflows/hugo.yaml`，并修改内容：

```yaml
# Sample workflow for building and deploying a Hugo site to GitHub Pages
name: Deploy Hugo site to Pages

on:
  # Runs on pushes targeting the default branch
  push:
    branches:
      - main

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

# Sets permissions of the GITHUB_TOKEN to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow only one concurrent deployment, skipping runs queued between the run in-progress and latest queued.
# However, do NOT cancel in-progress runs as we want to allow these production deployments to complete.
concurrency:
  group: "pages"
  cancel-in-progress: false

# Default to bash
defaults:
  run:
    shell: bash

jobs:
  # Build job
  build:
    runs-on: ubuntu-latest
    env:
      HUGO_VERSION: 0.114.0
    steps:
      - name: Install Hugo CLI
        run: |
          wget -O ${{ runner.temp }}/hugo.deb https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.deb \
          && sudo dpkg -i ${{ runner.temp }}/hugo.deb          
      - name: Install Dart Sass
        run: sudo snap install dart-sass
      - name: Checkout
        uses: actions/checkout@v3
        with:
          submodules: recursive
          fetch-depth: 0
      - name: Setup Pages
        id: pages
        uses: actions/configure-pages@v3
      - name: Install Node.js dependencies
        run: "[[ -f package-lock.json || -f npm-shrinkwrap.json ]] && npm ci || true"
      - name: Build with Hugo
        env:
          # For maximum backward compatibility with Hugo modules
          HUGO_ENVIRONMENT: production
          HUGO_ENV: production
        run: |
          hugo \
            --gc \
            --minify \
            --baseURL "${{ steps.pages.outputs.base_url }}/"          
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v1
        with:
          path: ./public

  # Deployment job
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v2
```

再次`git push`，至此，搭建已完成，可以通过自己的域名访问博客。

## 4. 后记

中间大概会遇到一些小问题，比如`Draft`没有设置，导致文章发表不成功、Git 命令不熟悉，不会添加远程的分支，不知道如何处理冲突、跟着官方教程一路 CV，但遇到报错不知道咋解决等等。遇到问题，可以试试`ChatGPT`为主，`Google`为辅的搜索流程。养成记笔记的习惯，遇到的问题大概率近期会继续碰到，整理到一起，方便后续遇到相同的错误或者命令可以快速解决。（吐槽一下`Logseq`的`Org mode`的语法和`markdown`不一样，要改的地方好多:(

## 5. 参考链接：

- [Hugo+Github Pages+Github Action博客方案之三——配置Github Action实现自动发布](https://zhuanlan.zhihu.com/p/568764664)
- [利用GitHub Action实现Hugo博客在GitHub Pages自动部署](https://lucumt.info/post/hugo/using-github-action-to-auto-build-deploy )
- [Host on GitHub](https://gohugo.io/hosting-and-deployment/hosting-on-github )
- [Github Pages + Hugo 搭建个人博客](https://zz2summer.github.io/github-pages-hugo-%E6%90%AD%E5%BB%BA%E4%B8%AA%E4%BA%BA%E5%8D%9A%E5%AE%A2/#%E4%BA%94%E6%96%B0%E5%BB%BA%E6%96%87%E7%AB%A0)

 
