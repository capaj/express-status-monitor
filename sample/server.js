const Koa = require('koa')
const app = new Koa()
const http = require('http')
const monitor = require('../index.js')
const server = http.createServer(app.callback())
app.use(monitor(server, { path: '/status', statusHtmlPage: 'index.html' }))

app.use(async function(ctx) {
  console.log(ctx)
  if (ctx.path === '/') {
    ctx.body = 'Hello World'
  }
})

server.listen(6001, () => {
  console.log('http://localhost:6001/')
})
