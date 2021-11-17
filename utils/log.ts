const DEBUG = false

export const consoleLog = (message: any, ...optionalParams: any[]) => {
    if (DEBUG) console.log(message, ...optionalParams)
}