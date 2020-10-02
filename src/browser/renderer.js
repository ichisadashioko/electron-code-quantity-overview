const electron = require('electron')
const path = require('path')
const fs = require('fs')

const MAX_FILE_SIZE = 1024 * 1024 * 10 // MB

const ignoredFiles = [
    'bin',
    'obj',
    '.git',
    '.vscode',
    'node_modules',
    'dist',
    '__pycache__',
    '.ipynb_checkpoints',
    'package-lock.json',
]

const ignoredExtensions = [
    '.ini', // Windows
    '.png',
    '.jpg',
    '.jpeg',
    '.json',
    '.dll',
    '.lock',
    '.gitignore',
    '.log',
]

/**
 * @type {{name: string, extensions: string[]}}
 */
const codeFileTypes = [
    {
        name: 'HTML',
        extensions: [
            '.htm',
            '.html',
        ],
    },
    {
        name: 'C/C++',
        extensions: [
            '.h',
            '.c',
            '.cc',
            '.hpp',
            '.cpp',
        ],
    },
    {
        name: 'Python',
        extensions: [
            '.py',
        ],
    },
    {
        name: 'JavaScript',
        extensions: [
            '.js',
            '.jsx'
        ],
    },
    {
        name: 'TypeScript',
        extensions: [
            '.ts',
            '.tsx',
        ],
    },
    {
        name: 'Java',
        extensions: [
            '.java',
        ],
    },
    {
        name: 'C#',
        extensions: [
            '.cs',
        ],
    },
    {
        name: 'CSS',
        extensions: [
            '.css',
        ],
    },
    {
        name: 'Markdown',
        extensions: [
            '.md',
        ],
    },
]

/**
 * 
 * @param {string} inPath 
 */
function buildFileTree(inPath) {
    let fileName = path.basename(inPath)
    // console.log(inPath)

    for (let i = 0; i < ignoredFiles.length; i++) {
        if (fileName.toLowerCase() === ignoredFiles[i]) {
            return null
        }
    }

    let stats = fs.lstatSync(inPath)

    if (stats.isDirectory()) {
        let childFiles = fs.readdirSync(inPath)
        console.log(childFiles)

        let children = []
        let size = 0
        let content = {}

        for (let i = 0; i < childFiles.length; i++) {
            let node = buildFileTree(path.join(inPath, childFiles[i]))

            if (node) {
                children.push(node)
                size += node.size

                let childContent = node.content
                for (let codeType in childContent) {
                    if (content[codeType]) {
                        content[codeType].lines += childContent[codeType].lines
                        content[codeType].nonEmptyLines += childContent[codeType].nonEmptyLines
                        content[codeType].size += childContent[codeType].size
                    } else {
                        content[codeType] = { ...childContent[codeType] }
                    }
                }
            }
        }

        return {
            name: fileName,
            children: children,
            size: size,
            content: content,
        }
    } else if (stats.isFile()) {
        if (stats.size > MAX_FILE_SIZE) {
            console.log(`Skipping ${inPath} because file is too large ${stats.size} bytes!`)
            return null
        }

        let extension = path.extname(inPath).toLowerCase()

        for (let i = 0; i < ignoredExtensions.length; i++) {
            if (extension === ignoredExtensions[i]) {
                return null
            }
        }

        let isTextFile = true
        let numLines = 0
        let numNonEmptyLines = 0

        let textContent = fs.readFileSync(inPath, {
            encoding: 'utf-8',
            flag: 'r',
        })

        // console.log(textContent)

        let prevChar = null

        for (let cIdx = 0, l = textContent.length; cIdx < l; cIdx++) {
            let curChar = textContent[cIdx]
            if (curChar === '�') {
                isTextFile = false
                break
            } else if (curChar === '\n') {
                numLines++

                if ((prevChar !== null) && (prevChar !== '\n')) {
                    numNonEmptyLines++
                }
            } else if (curChar === '\r') {
                continue
            } else {
                prevChar = curChar
            }
        }

        if (!isTextFile) {
            return null
        }

        let codeTypeName

        for (let i = 0; i < codeFileTypes.length; i++) {
            let codeType = codeFileTypes[i]

            if (codeType.extensions.indexOf(extension) > -1) {
                codeTypeName = codeType.name
                break
            }
        }

        if (!codeTypeName) {
            codeTypeName = 'Other'
        }

        let content = {}
        content[codeTypeName] = {
            lines: numLines,
            nonEmptyLines: numNonEmptyLines,
            size: stats.size,
        }

        return {
            name: fileName,
            size: stats.size,
            content: content,
        }
    } else {
        return null
    }
}

function setRoot(node, root) {
    node.root = root

    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            setRoot(node.children[i], root)
        }
    }
}

let Metrics = [
    'size',
    'lines of code',
    'non empty lines of code',
]

class TreeWidget {
    constructor(props) {
        this.name = props.name
        this.children = props.children
        this.content = props.content
        this.metric = props.metric
        this.root = props.root

        this.element = document.createElement('div')
        this.expanded = false

        this.mainBar = document.createElement('div')
        this.mainBar.className = 'node-row-info'

        let title = document.createElement('span')
        title.textContent = this.name
        this.mainBar.appendChild(title)

        this.element.appendChild(this.mainBar)

        if (this.root) {
            for (let codeType in this.content) {
                if (typeof (this.metric) === 'string') {
                    this.metric = +this.metric
                }

                for (let metricIdx = 0; metricIdx < Metrics.length; metricIdx++) {
                    if (this.metric === metricIdx) {
                        let total = this.root.content[codeType][metricIdx]
                        let local = this.content[codeType][metricIdx]
                        let portion = (local * 100 / total).toFixed(1)
                        let title = `${local}/${total}`

                        let infoSpan = document.createElement('span')
                        infoSpan.textContent = `${portion}% ${codeType}`
                        infoSpan.title = title
                        infoSpan.className = 'code-info'

                        this.mainBar.appendChild(infoSpan)
                        break
                    }
                }
            }
        }

        let ul = document.createElement('ul')
        this.element.appendChild(ul)

        if (this.children) {
            this.children.forEach(function (node) {
                let childTree = new TreeWidget(node)
                let li = document.createElement('li')
                li.appendChild(childTree.element)
                ul.appendChild(li)
            })
        }
    }
}

class MetricSelectorWidget {
    constructor() {
        this.element = document.createElement('select')
        let that = this

        Metrics.forEach(function (value, index) {
            let childEl = document.createElement('option')
            childEl.value = index
            childEl.text = value

            that.element.appendChild(childEl)
        })
    }
}

let appDiv = document.getElementById('main')
let fileChooser = document.createElement('button')
appDiv.appendChild(fileChooser)

fileChooser.textContent = 'Choose Directory'

fileChooser.addEventListener('click', function () {
    electron.remote.dialog.showOpenDialog(electron.remote.getCurrentWindow(), {
        properties: [
            'openDirectory',
        ],
    }).then(function (ret) {
        if (ret.filePaths.length !== 0) {
            // TODO handle multiple files/directories
            let selectedFile = ret.filePaths[0]

            if (fs.existsSync(selectedFile)) {
                console.log('selectedFile: ' + selectedFile)
                let node = buildFileTree(selectedFile)

                // TODO handle changed state
                console.log(node)

                setRoot(node, node)
                let treeWidget = new TreeWidget(node)
                appDiv.appendChild(treeWidget.element)
            }
        }
    })
})

let metricSelectorWidget = new MetricSelectorWidget()
appDiv.appendChild(metricSelectorWidget.element)
