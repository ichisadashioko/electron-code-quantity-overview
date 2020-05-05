import { app, BrowserWindow } from 'electron'
import * as path from 'path'
import * as url from 'url'

function createWindow() {
    // create the browser window
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        // set the background color to black
        backgroundColor: '#111',
        // set the title bar style
        titleBarStyle: 'hiddenInset',
        // don't show the window until it's ready, this prevents any white flickering
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
        },
    })

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, '../index.html'),
        protocol: 'file:',
        slashes: true,
    }))

    mainWindow.once('ready-to-show', function () {
        console.log(arguments)
        mainWindow.show()
    })

    // open the DevTools
    mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished initialization
// and is ready to create browser windows. Some APIs can only be used
// after this event occurs.
app.whenReady().then(createWindow)

// quit when all windows are closed
app.on('window-all-closed', function () {
    // On OS X it is common for applications and their menu bar to stay
    // active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', function () {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// In this file you can include the rest of your app's specific main
// process code. You can also put them in separate files and require
// them here.