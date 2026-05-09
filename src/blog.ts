import './blog.css'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
<main class="blog-page">
  <header class="topbar">
    <div class="brand">fengzi</div>
    <a class="badminton-link" href="/" aria-label="返回羽毛球页面">返回排表</a>
  </header>

  <section class="hero">
    <p class="badge">FAST · MOBILE · COOL</p>
    <h1>冷淡，克制，持续输出</h1>
    <p class="sub">fengzi 的个人博客：开发笔记、训练记录、工具清单。</p>
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
