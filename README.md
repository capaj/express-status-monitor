# koa-monitor ![npm badge](https://nodei.co/npm/koa-monitor.png)

Simple, self-hosted module based on Socket.io and Chart.js to report realtime server metrics for koa.js-based node servers.

![Monitoring Page](http://i.imgur.com/AHizEWq.gif 'Monitoring Page')

## Installation & setup

1. Run `npm install koa-monitor --save`
2. Before any other middleware add following line:

```javascript
const monitor = require('koa-monitor')
// then after
app.use(monitor(server, { path: '/status' }))
```

3. Run server and go to `/status`

## Options

Monitor can be configured by passing options(second argument) object into `monitor` constructor.

Default config:

```
path: '/status',
spans: [{
  interval: 1,     // Every second
  retention: 60    // Keep 60 datapoints in memory
}, {
  interval: 5,     // Every 5 seconds
  retention: 60
}, {
  interval: 15,    // Every 15 seconds
  retention: 60
}]

```

For an example koa server, check out `sample/server.js'

## License

[MIT License](https://opensource.org/licenses/MIT) © Jiří Špác

Forked from [express-status-monitor](https://github.com/RafalWilinski/express-status-monitor)
