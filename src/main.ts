import { app, Menu, Tray } from 'electron'
import * as path from 'path'

let tray = null

app.on('ready', function () {
    tray = new Tray(path.join(__dirname, '../electron.png'))

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Item1', type: <const>'radio' },
        { label: 'Item2', type: <const>'radio', checked: true },
        { label: 'Item3', type: <const>'radio' },
        {
            label: 'Exit', type: <const>'normal', click: function () {
                // console.log(arguments)
                app.exit()
            }
        },
    ])

    tray.setToolTip('Electron tray icon')
    tray.setContextMenu(contextMenu)
})