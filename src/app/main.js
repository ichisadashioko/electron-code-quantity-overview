const electron = require('electron')
const path = require('path')

function createWindow() {
    // create the browser window
    const mainWindow = new electron.BrowserWindow({
        width: 1280,
        height: 720,
        webPreferences: {
            nodeIntegration: true,
            enableRemoteModule: true,
        }
    })

    // and load the index.html of the app
    mainWindow.loadFile(path.join(__dirname, '../../index.html'))

    // open DevTools
    mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished initialization and is ready to create browser windows. Some APIs can only be used after this event occurs.
electron.app.whenReady().then(createWindow)

// quit when all windows are closed
electron.app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        electron.app.quit()
    }
})

electron.app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open
    if (electron.BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})
