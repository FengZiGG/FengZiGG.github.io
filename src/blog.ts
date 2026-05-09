import './blog.css'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
<main class="blog-page">
  <header class="topbar">
    <div class="brand">Wang Xinfeng Blog</div>
    <a class="badminton-link" href="/badminton/" aria-label="进入羽毛球图表页面">🏸 羽毛球图表</a>
  </header>

  <section class="hero">
    <p class="badge">FAST · MOBILE · COOL</p>
    <h1>写代码、打羽毛球、记录生活</h1>
    <p class="sub">一个追求速度与质感的个人博客。内容覆盖开发实践、效率工具、以及每周羽毛球活动记录。</p>
  </section>

  <section class="cards">
    <article class="card">
      <h2>开发日志</h2>
      <p>前端、工程化、AI 编程协作的实战复盘。</p>
    </article>
    <article class="card">
      <h2>效率系统</h2>
      <p>工作流、自动化、任务拆解与执行体系。</p>
    </article>
    <article class="card">
      <h2>羽毛球专栏</h2>
      <p>活动组织、排表策略、训练笔记与复盘。</p>
    </article>
  </section>
</main>
`
