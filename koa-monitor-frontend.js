/* global Chart, location, io */
Chart.defaults.global.defaultFontSize = 8
Chart.defaults.global.animation.duration = 500
Chart.defaults.global.legend.display = false
Chart.defaults.global.elements.line.backgroundColor = 'rgba(0,0,0,0)'
Chart.defaults.global.elements.line.borderColor = 'rgba(0,0,0,0.9)'
Chart.defaults.global.elements.line.borderWidth = 2

const socket = io(`${location.protocol}//${location.hostname}:${location.port}`)
let defaultSpan = 0
const spans = []

const defaultDataset = {
  label: '',
  data: [],
  lineTension: 0.2,
  pointRadius: 0
}

const defaultOptions = {
  scales: {
    yAxes: [
      {
        ticks: {
          beginAtZero: true
        }
      }
    ],
    xAxes: [
      {
        type: 'time',
        time: {
          unitStepSize: 30
        },
        gridLines: {
          display: false
        }
      }
    ]
  },
  tooltips: {
    enabled: false
  },
  responsive: true,
  maintainAspectRatio: false,
  animation: false
}

const createChart = (ctx, dataset) =>
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: dataset
    },
    options: defaultOptions
  })

const addTimestamp = ({ timestamp }) => timestamp

const cpuDataset = [Object.create(defaultDataset)]
const memDataset = [Object.create(defaultDataset)]
const loadDataset = [Object.create(defaultDataset)]
const responseTimeDataset = [Object.create(defaultDataset)]
const rpsDataset = [Object.create(defaultDataset)]

const cpuStat = document.getElementById('cpuStat')
const memStat = document.getElementById('memStat')
const loadStat = document.getElementById('loadStat')
const responseTimeStat = document.getElementById('responseTimeStat')
const rpsStat = document.getElementById('rpsStat')

const cpuChartCtx = document.getElementById('cpuChart')
const memChartCtx = document.getElementById('memChart')
const loadChartCtx = document.getElementById('loadChart')
const responseTimeChartCtx = document.getElementById('responseTimeChart')
const rpsChartCtx = document.getElementById('rpsChart')

const cpuChart = createChart(cpuChartCtx, cpuDataset)
const memChart = createChart(memChartCtx, memDataset)
const loadChart = createChart(loadChartCtx, loadDataset)
const responseTimeChart = createChart(responseTimeChartCtx, responseTimeDataset)
const rpsChart = createChart(rpsChartCtx, rpsDataset)

const charts = [cpuChart, memChart, loadChart, responseTimeChart, rpsChart]

const onSpanChange = ({ target }) => {
  target.classList.add('active')
  defaultSpan = parseInt(target.id)

  const otherSpans = document.getElementsByTagName('span')
  for (let i = 0; i < otherSpans.length; i++) {
    if (otherSpans[i] !== target) otherSpans[i].classList.remove('active')
  }

  socket.emit('change')
}

socket.on('start', (data) => {
  // Remove last element of Array because it contains malformed responses data.
  // To keep consistency we also remove os data.
  data[defaultSpan].responses.pop()
  data[defaultSpan].os.pop()

  // Bug fix for requiring browser refresh when koa-server restarted
  const osData = data[defaultSpan].os[data[defaultSpan].os.length - 1]
  if (!osData || !('cpu' in osData)) {
    socket.emit('change')
    return
  }

  cpuStat.textContent = `${data[defaultSpan].os[
    data[defaultSpan].os.length - 1
  ].cpu.toFixed(1)}%`
  cpuChart.data.datasets[0].data = data[defaultSpan].os.map(({ cpu }) => cpu)
  cpuChart.data.labels = data[defaultSpan].os.map(addTimestamp)

  memStat.textContent = `${data[defaultSpan].os[
    data[defaultSpan].os.length - 1
  ].memory.toFixed(1)}MB`
  memChart.data.datasets[0].data = data[defaultSpan].os.map(
    ({ memory }) => memory
  )
  memChart.data.labels = data[defaultSpan].os.map(addTimestamp)

  loadStat.textContent = data[defaultSpan].os[
    data[defaultSpan].os.length - 1
  ].load[defaultSpan].toFixed(2)
  loadChart.data.datasets[0].data = data[defaultSpan].os.map(
    ({ load }) => load[0]
  )
  loadChart.data.labels = data[defaultSpan].os.map(addTimestamp)

  responseTimeStat.textContent = `${data[defaultSpan].responses[
    data[defaultSpan].responses.length - 1
  ].mean.toFixed(2)}ms`
  responseTimeChart.data.datasets[0].data = data[defaultSpan].responses.map(
    ({ mean }) => mean
  )
  responseTimeChart.data.labels = data[defaultSpan].responses.map(addTimestamp)

  if (data[defaultSpan].responses.length >= 2) {
    const deltaTime =
      data[defaultSpan].responses[data[defaultSpan].responses.length - 1]
        .timestamp -
      data[defaultSpan].responses[data[defaultSpan].responses.length - 2]
        .timestamp
    rpsStat.textContent = (
      (data[defaultSpan].responses[data[defaultSpan].responses.length - 1]
        .count /
        deltaTime) *
      1000
    ).toFixed(2)
    rpsChart.data.datasets[0].data = data[defaultSpan].responses.map(
      ({ count }) => (count / deltaTime) * 1000
    )
    rpsChart.data.labels = data[defaultSpan].responses.map(addTimestamp)
  }

  charts.forEach((chart) => {
    chart.update()
  })

  const spanControls = document.getElementById('span-controls')
  if (data.length !== spans.length) {
    data.forEach(({ retention, interval }, index) => {
      spans.push({
        retention: retention,
        interval: interval
      })

      const spanNode = document.createElement('span')
      const textNode = document.createTextNode(
        `${(retention * interval) / 60}M`
      )
      spanNode.appendChild(textNode)
      spanNode.setAttribute('id', index)
      spanNode.onclick = onSpanChange
      spanControls.appendChild(spanNode)
    })
    document.getElementsByTagName('span')[0].classList.add('active')
  }
})

socket.on('stats', ({ retention, interval, os, responses }) => {
  if (
    retention === spans[defaultSpan].retention &&
    interval === spans[defaultSpan].interval
  ) {
    cpuStat.textContent = `${os.cpu.toFixed(1)}%`
    cpuChart.data.datasets[0].data.push(os.cpu)
    cpuChart.data.labels.push(os.timestamp)

    memStat.textContent = `${os.memory.toFixed(1)}MB`
    memChart.data.datasets[0].data.push(os.memory)
    memChart.data.labels.push(os.timestamp)

    loadStat.textContent = os.load[0].toFixed(2)
    loadChart.data.datasets[0].data.push(os.load[0])
    loadChart.data.labels.push(os.timestamp)

    responseTimeStat.textContent = `${responses.mean.toFixed(2)}ms`
    responseTimeChart.data.datasets[0].data.push(responses.mean)
    responseTimeChart.data.labels.push(responses.timestamp)

    const deltaTime =
      responses.timestamp -
      rpsChart.data.labels[rpsChart.data.labels.length - 1]
    if (deltaTime > 0) {
      rpsStat.textContent = ((responses.count / deltaTime) * 1000).toFixed(2)
      rpsChart.data.datasets[0].data.push((responses.count / deltaTime) * 1000)
      rpsChart.data.labels.push(responses.timestamp)
    }

    charts.forEach((chart) => {
      if (spans[defaultSpan].retention < chart.data.labels.length) {
        chart.data.datasets[0].data.shift()
        chart.data.labels.shift()
      }

      chart.update()
    })
  }
})
