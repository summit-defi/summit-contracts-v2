const DEBUG = true

export const consoleLog = (message: any, ...optionalParams: any[]) => {
    if (DEBUG) console.log(message, ...optionalParams)
}