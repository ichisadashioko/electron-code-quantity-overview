import { remote } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

import * as React from 'react'
import { render } from 'react-dom'
import Octicon, { FileDirectory, File, OcticonProps } from '@primer/octicons-react'
import { combineReducers, createStore } from 'redux'
import { Provider, connect } from 'react-redux'
import { isTextSync } from 'istextorbinary'

function Spinner() {
    return <div className='lds-spinner'>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
    </div>
}

interface IconProps extends OcticonProps {
    iconWrapperClassName?: string
}

/**
 * Octicon wrapper for adding padding.
 */
function Icon(props: IconProps) {
    return <span
        className={props.iconWrapperClassName}
        style={{
            paddingRight: '5px',
            paddingLeft: '5px',
        }}
    ><Octicon {...props} /></span>
}

const MAX_FILE_SIZE = 1024 * 1024 * 10 // MB

const ignoreFiles = [
    'bin',
    'obj',
    '.git',
    '.vscode',
    'node_modules',
    'dist',
]

const ignoreExtensions = [
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

interface CodeFileType {
    name: string
    extensions: string[]
}

const codeFileTypes: CodeFileType[] = [
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

function countLines(inPath: string) {
    try {
        let textContent = fs.readFileSync(inPath, {
            encoding: 'utf-8',
            flag: 'r',
        })

        console.log(textContent)

        let lines = textContent.split('\n')
        let numNonEmptyLines = 0

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i]

            if (line.length === 0) {
                continue
            } else {
                numNonEmptyLines++
            }
        }

        // console.log(textContent)

        return {
            totalLines: lines.length,
            numNonEmptyLines: numNonEmptyLines,
        }
    } catch (error) {
        console.log(error)
    }
}

type FileContent = Record<string, { lines: number, nonEmptyLines: number, size: number }>

interface FileNodeStats {
    name: string
    children?: FileNodeStats[]
    size: number
    root?: FileNodeStats
    content: FileContent
}

function buildFileTree(inPath: string): FileNodeStats {
    let fileName = path.basename(inPath)
    console.log(inPath)

    for (let i = 0; i < ignoreFiles.length; i++) {
        if (fileName.toLowerCase() === ignoreFiles[i]) {
            return null
        }
    }

    let stats = fs.lstatSync(inPath)

    if (stats.size > MAX_FILE_SIZE) {
        console.log(`Skipping ${inPath} because file is too large ${stats.size} bytes!`)
        return null
    }

    if (stats.isDirectory()) {
        let childFiles = fs.readdirSync(inPath)
        console.log(childFiles)

        let children = []
        let size = 0
        let content: FileContent = {}

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
        let extension = path.extname(inPath).toLowerCase()

        for (let i = 0; i < ignoreExtensions.length; i++) {
            if (extension === ignoreExtensions[i]) {
                return null
            }
        }

        let isTextFile = isTextSync(inPath)

        if (!isTextFile) {
            return null
        }

        let lineCounts = countLines(inPath)
        console.log(lineCounts)

        let codeTypeName: string

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

        let content: FileContent = {}
        content[codeTypeName] = {
            lines: lineCounts.totalLines,
            nonEmptyLines: lineCounts.numNonEmptyLines,
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

function setRoot(node: FileNodeStats, root: FileNodeStats) {
    node.root = root

    if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
            setRoot(node.children[i], root)
        }
    }
}

const ul: React.CSSProperties = {
    listStyle: 'none',
    paddingLeft: '20px',
}

const style = {
    ul: ul,
}

enum Metric {
    Size,
    LinesOfCode,
    NonEmptyLinesOfCode,
}


// I only use tsc to compile TypeScript so there is no bundler.
// Electron doesn't resolve relative module correctly so I have to put
// all the code into a single file.
interface AppState {
    node: FileNodeStats
    metric: Metric
}

const UPDATE_METRIC = 'UPDATE_METRIC'

interface UpdateMetricAction {
    type: typeof UPDATE_METRIC
    payload: Metric
}

const SET_NODE = 'SET_NODE'

interface SetNodeAction {
    type: typeof SET_NODE
    payload: FileNodeStats
}

type AppActionTypes = UpdateMetricAction | SetNodeAction

function updateMetric(metric: Metric): AppActionTypes {
    return {
        type: UPDATE_METRIC,
        payload: metric,
    }
}

function setNode(node: FileNodeStats): AppActionTypes {
    return {
        type: SET_NODE,
        payload: node,
    }
}

const appInitialState: AppState = {
    node: null,
    metric: Metric.LinesOfCode,
}

function appReducer(state = appInitialState, action: AppActionTypes): AppState {
    switch (action.type) {
        case UPDATE_METRIC:
            return {
                ...state,
                metric: action.payload,
            }
        case SET_NODE:
            return {
                ...state,
                node: action.payload,
            }
        default:
            return state
    }
}

const rootReducer = combineReducers({
    app: appReducer,
})

type RootState = ReturnType<typeof rootReducer>

const store = createStore(rootReducer)

interface CodeInfoSpanProps {
    title?: string
    codeType: string
    ratio: string
}

function CodeInfoSpan({ codeType, ratio, title }: CodeInfoSpanProps) {
    return <span className='code-info' title={title}>
        {codeType} - {ratio}%
    </span>
}

interface TreeNodeProps extends FileNodeStats {
    metric: Metric
}

class TreeNode extends React.Component<TreeNodeProps, {}>{
    state = {
        expanded: false,
    }

    constructor(props: TreeNodeProps) {
        super(props)
        this.toggleExpand = this.toggleExpand.bind(this)
    }

    toggleExpand() {
        this.setState({
            expanded: !this.state.expanded,
        })
    }

    render() {
        const { name, children, content, root, metric } = this.props

        // console.log(`Rendering ${name} with ${Metric[metric]}`)
        let contentInfos = []
        if (root) {
            for (let codeType in content) {
                let portion: string
                let title: string

                // console.log(`${metric} - ${typeof metric}`)
                if (typeof metric === 'string') {
                    // https://stackoverflow.com/a/14668510/8364403
                    // @ts-ignore
                    metric = +metric
                }

                switch (metric) {
                    case Metric.LinesOfCode:
                        let lines = content[codeType].lines
                        let rootLines = root.content[codeType].lines
                        console.log(`lines - ${lines} - ${rootLines}`)
                        portion = (lines * 100 / rootLines).toFixed(1)
                        title = `${lines} line(s) out of ${rootLines} line(s)`
                        break
                    case Metric.NonEmptyLinesOfCode:
                        let nonEmptyLines = content[codeType].nonEmptyLines
                        let rootNonEmptyLines = root.content[codeType].nonEmptyLines
                        console.log(`non empty lines - ${nonEmptyLines} / ${rootNonEmptyLines}`)
                        portion = (nonEmptyLines * 100 / rootNonEmptyLines).toFixed(1)
                        title = `${nonEmptyLines} line(s) out of ${rootNonEmptyLines} line(s)`
                        break
                    default:
                        let size = content[codeType].size
                        let rootSize = root.content[codeType].size
                        console.log(`size - ${size} - ${rootSize}`)
                        portion = (size * 100 / rootSize).toFixed(1)
                        title = `${size} byte(s) out of ${rootSize} byte(s)`
                        break
                }

                // console.log(`${codeType} - ${portion}`)
                contentInfos.push(<CodeInfoSpan
                    codeType={codeType} ratio={portion}
                    title={title}
                />)
            }
        }

        let className = 'node-row-info'

        if (children) {
            if (this.state.expanded) {
                className += ' collapse-icon'
            } else {
                className += ' expand-icon'
            }
        }

        return <div>
            <div
                onClick={this.toggleExpand}
                className={className}
            >
                {!!(children) ? <Icon icon={FileDirectory} /> : <Icon icon={File} />}
                <span>{name}</span>
                {contentInfos}
            </div>
            {this.state.expanded ? this.props.children ? <ul style={style.ul}>
                {this.props.children.map((node) => {
                    return <li key={node.name}>
                        <TreeNode
                            name={node.name}
                            metric={this.props.metric}
                            size={node.size}
                            content={node.content}
                            children={node.children}
                            root={node.root}
                        />
                    </li>
                })}
            </ul> : null : null}
        </div>
    }
}
class FileChooser extends React.Component {
    constructor(props: {}) {
        super(props)
        this.handleOnClick = this.handleOnClick.bind(this)
    }

    handleOnClick() {
        console.log(arguments)
        const that = this

        remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
            properties: [
                'openDirectory',
            ],
        }).then(function (ret) {
            if (ret.filePaths.length !== 0) {
                let selectedFile = ret.filePaths[0]
                fs.exists(selectedFile, function (exists) {
                    if (exists) {
                        console.log(selectedFile)
                        let node = buildFileTree(selectedFile)
                        setRoot(node, node)

                        store.dispatch(setNode(node))
                    }
                })
            }
        })
    }

    render() {
        return <button
            onClick={this.handleOnClick}
            className='btn btn-primary'>
            Choose Directory
        </button>
    }
}

interface AppProps {
    node: FileNodeStats
    metric: Metric
}

interface MetricSelectorProps {
    metric: Metric
}

function MetricSelector(props: MetricSelectorProps) {
    return <select value={props.metric} onChange={function (ev) {
        let value = ev.target.value
        // console.log(value)
        // console.log(typeof value)

        // @ts-ignore
        store.dispatch(updateMetric(value))
    }}>
        <option value={Metric.LinesOfCode}>{Metric[Metric.LinesOfCode]}</option>
        <option value={Metric.NonEmptyLinesOfCode}>{Metric[Metric.NonEmptyLinesOfCode]}</option>
        <option value={Metric.Size}>{Metric[Metric.Size]}</option>
    </select>
}

function App(props: AppProps) {
    return <div>
        <FileChooser />
        <MetricSelector metric={props.metric} />
        {props.node != null ? <TreeNode
            metric={props.metric}
            name={props.node.name}
            size={props.node.size}
            content={props.node.content}
            children={props.node.children}
            root={props.node.root}
        /> : null}
    </div>
}

function mapAppStateToProps(state: RootState): AppState {
    return {
        node: state.app.node,
        metric: state.app.metric,
    }
}

let ConnectedApp = connect(mapAppStateToProps)(App)

render(
    <Provider store={store}>
        <ConnectedApp />
    </Provider>,
    document.getElementById('main'),
)