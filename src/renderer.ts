import * as os from 'os'
import * as Chart from 'chart.js'

let chart: Chart
let lastMeasureTimes: number[][] = []

function setLastMeasureTimes(cpus: os.CpuInfo[]) {
    for (let i = 0; i < cpus.length; i++) {
        lastMeasureTimes[i] = getCpuTimes(cpus[i])
    }
}

function getCpuTimes(cpu: os.CpuInfo) {
    return [
        cpu.times.user,
        cpu.times.sys,
        cpu.times.idle,
    ]
}

function getDatasets() {
    const datasets = []
    const cpus = os.cpus()

    for (let i = 0; i < cpus.length; i++) {
        const cpu = cpus[i]
        const cpuData = {
            data: getCpuTimes(cpu),
            backgroundColor: [
                'rgba(255, 99, 132, 1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
            ],
        }

        datasets.push(cpuData)
    }

    return datasets
}

function updateDatasets() {
    const cpus = os.cpus()
    for (let i = 0; i < cpus.length; i++) {
        const cpu = cpus[i]
        chart.data.datasets[i].data = getCpuTimes(cpu)

        for (let j = 0; j < 3; j++) {
            let x = chart.data.datasets[i].data[j] as number
            x -= lastMeasureTimes[i][j]
            chart.data.datasets[i].data[j] = x
        }
    }

    chart.update()
    setLastMeasureTimes(cpus)
}

function drawChart() {
    let element = document.getElementById('chart') as HTMLCanvasElement
    chart = new Chart(element, {
        type: 'doughnut',
        data: {
            labels: [
                'User Time (ms)',
                'System Time (ms)',
                'Idle Time (ms)',
            ],
            datasets: getDatasets(),
        },
        options: {
            maintainAspectRatio: false,
            title: {
                display: true,
                text: 'CPU Activity',
                fontColor: 'rgb(250, 250, 250)',
                fontSize: 16,
            },
            legend: {
                display: true,
                labels: {
                    fontColor: 'rgb(250, 250, 250)',
                    fontSize: 12,
                }
            },
        },
    })

    setInterval(updateDatasets, 1000)
}

setLastMeasureTimes(os.cpus())
drawChart()