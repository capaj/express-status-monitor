'use strict'

import * as SocketIO from 'socket.io'
import { Context } from 'koa'
import Application = require('koa')

const fs = require('mz/fs')
const path = require('path')
const os = require('os')
const pidusage = require('pidusage')
const handlebars = require('handlebars')

let io: SocketIO.Server
let appName
try {
  appName = require('../../package.json').name
} catch (err) {}

interface Stat {
  cpu: number
  memory: number
  ppid: number
  pid: number
  ctime: number
  elapsed: number
  timestamp: number
  load: number[]
}

interface SpanResponse {
  '2': number
  '3': number
  '4': number
  '5': number
  count: number
  mean: number
  timestamp: number // Date.getTime()
}

interface SpanElement {
  interval: number
  retention: number
  os: any[]
  responses: SpanResponse[]
}

interface Config {
  path: string
  title: string
  spans: SpanElement[]
  requestTimeout?: number
}

const defaultConfig: Config = {
  path: '/status',
  title: appName,
  spans: [
    {
      interval: 1,
      retention: 60,
      os: [],
      responses: []
    },
    {
      interval: 5,
      retention: 60,
      os: [],
      responses: []
    },
    {
      interval: 15,
      retention: 60,
      os: [],
      responses: []
    }
  ]
}

const last = function(arr: Array<any>) {
  return arr[arr.length - 1]
}

const gatherOsMetrics = (io: SocketIO.Server, span: SpanElement) => {
  const defaultResponse: SpanResponse = {
    '2': 0,
    '3': 0,
    '4': 0,
    '5': 0,
    count: 0,
    mean: 0,
    timestamp: Date.now()
  }

  const sendMetrics = (span: SpanElement) => {
    io.emit('stats', {
      os: span.os[span.os.length - 2],
      responses: span.responses[span.responses.length - 2],
      interval: span.interval,
      retention: span.retention
    })
  }

  pidusage(process.pid, (err: Error | null, stat: Stat) => {
    if (err) {
      console.error(err)
      return
    }
    // console.log(stat);
    stat.memory = stat.memory / 1024 / 1024 // Convert from B to MB
    stat.load = os.loadavg()
    stat.timestamp = Date.now()

    span.os.push(stat)
    if (
      !span.responses[0] ||
      last(span.responses).timestamp + span.interval * 1000 < Date.now()
    )
      span.responses.push(defaultResponse)

    if (span.os.length >= span.retention) span.os.shift()
    if (span.responses[0] && span.responses.length > span.retention)
      span.responses.shift()

    sendMetrics(span)
  })
}

const encoding = { encoding: 'utf8' }

const middlewareWrapper = (app: Application, config: Config) => {
  if (!app.listen) {
    throw new Error('First parameter must be an http server')
  }
  io = require('socket.io')(app)
  Object.assign(defaultConfig, config)
  config = defaultConfig
  const htmlFilePath = path.join(__dirname, 'index.html')
  const indexHtml = fs.readFileSync(htmlFilePath, encoding)
  const template = handlebars.compile(indexHtml)

  io.on('connection', (socket) => {
    socket.emit('start', config.spans)
    socket.on('change', function() {
      socket.emit('start', config.spans)
    })
  })

  config.spans.forEach((span: SpanElement) => {
    span.os = []
    span.responses = []
    const interval = setInterval(
      () => gatherOsMetrics(io, span),
      span.interval * 1000
    )
    interval.unref()
  })
  // console.log(config)

  return async (ctx: Context, next: Function) => {
    const startTime = process.hrtime()

    if (ctx.path === config.path) {
      ctx.body = template(config)
    } else if (ctx.url === `${config.path}/koa-monitor-frontend.js`) {
      const pathToJs = path.join(__dirname, 'koa-monitor-frontend.js')
      ctx.type = 'js'
      ctx.body = await fs.readFile(pathToJs, encoding)
    } else {
      let timer
      if (config.requestTimeout) {
        timer = setTimeout(() => {
          record.call(ctx, true)
        }, config.requestTimeout)
      }

      await next

      timer && clearTimeout(timer)
      record.call(ctx)
    }

    function record(timeout?: boolean) {
      const diff = process.hrtime(startTime)
      const responseTime = diff[0] * 1e3 + diff[1] * 1e-6
      // if timeout, set response code to 5xx.
      const category = timeout ? 5 : Math.floor(ctx.statusCode / 100)

      config.spans.forEach((span: SpanElement) => {
        const lastResponse = last(span.responses)
        if (
          lastResponse &&
          lastResponse.timestamp / 1000 + span.interval > Date.now() / 1000
        ) {
          lastResponse[category]++
          lastResponse.count++
          lastResponse.mean =
            lastResponse.mean +
            (responseTime - lastResponse.mean) / lastResponse.count
        } else {
          span.responses.push({
            '2': category === 2 ? 1 : 0,
            '3': category === 3 ? 1 : 0,
            '4': category === 4 ? 1 : 0,
            '5': category === 5 ? 1 : 0,
            count: 1,
            mean: responseTime,
            timestamp: Date.now()
          })
        }
      })
    }
  }
}

module.exports = middlewareWrapper
