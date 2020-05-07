import { remote } from 'electron'
import * as path from 'path'
import * as fs from 'fs'

import * as React from 'react'
import { render } from 'react-dom'
import Octicon, { TriangleRight, TriangleDown, FileDirectory, File, OcticonProps } from '@primer/octicons-react'

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
]

interface CodeFileType {
    name: string
    extensions: string[]
}

const codeFileTypes: CodeFileType[] = [
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
]

function countLines(inPath: string) {
    try {
        let textContent = fs.readFileSync(inPath, {
            encoding: 'utf-8',
        })

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

type FileContent = Record<string, { lines: number, nonEmptyLines: number }>

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
                    } else {
                        content[codeType] = childContent[codeType]
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

        let content = {}
        content[codeTypeName] = {
            lines: lineCounts.totalLines,
            nonEmptyLines: lineCounts.numNonEmptyLines,
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

const ul: React.CSSProperties = {
    listStyle: 'none',
    paddingLeft: '20px',
}

const style = {
    ul: ul,
}

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

interface FileChooserProps {
    onFileSelected?: (selectedFilePath: string) => void
}

class FileChooser extends React.Component<FileChooserProps, {}> {
    constructor(props: FileChooserProps) {
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
                        if (that.props.onFileSelected) {
                            that.props.onFileSelected(selectedFile)
                        }
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

/**
 * Octicon wrapper for padding.
 */
function Icon({ icon }: OcticonProps) {
    return <span
        style={{
            paddingRight: '5px',
            paddingLeft: '5px',
        }}>
        <Octicon icon={icon} />
    </span>
}

class TreeNode extends React.Component<FileNodeStats, {}>{
    state = {
        expanded: false,
    }

    constructor(props: FileNodeStats) {
        super(props)
        this.toggleExpand = this.toggleExpand.bind(this)
    }

    renderChildren() {
        if (this.props.children) {
            const listItems = this.props.children.map(function (node) {
                return <li key={node.name}>{React.createElement(TreeNode, node)}</li>
            })

            return <ul style={style.ul}>{listItems}</ul>
        } else {
            return (null)
        }
    }

    toggleExpand() {
        this.setState({
            expanded: !this.state.expanded,
        })

        console.log({ ...this.props.content })
    }

    render() {
        const { name, children, size } = this.props

        return <div>
            <div
                onClick={this.toggleExpand}
                className='node-row-info'
            >
                {!!(children) ?
                    (this.state.expanded ?
                        <Icon icon={TriangleDown} />
                        : <Icon icon={TriangleRight} />
                    )
                    : null
                }
                {!!(children) ? <Icon icon={FileDirectory} /> : <Icon icon={File} />}
                <span>{name} - {size} bytes</span>
            </div>
            {this.state.expanded ? this.renderChildren() : null}
        </div>
    }
}

class App extends React.Component {
    state: { fileNode?: FileNodeStats } = {
        fileNode: null,
    }

    constructor(props: {}) {
        super(props)
        this.onFileSelected = this.onFileSelected.bind(this)
    }

    onFileSelected(filePath: string) {
        this.setState({
            fileNode: buildFileTree(filePath),
        })
    }

    render() {
        return <div>
            <FileChooser onFileSelected={this.onFileSelected} />
            {this.state.fileNode != null ? React.createElement(TreeNode, this.state.fileNode) : null}
        </div>
    }
}

render(<App />, document.getElementById('main'))