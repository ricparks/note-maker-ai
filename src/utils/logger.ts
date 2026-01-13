export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LEVELS: Record<LogLevel, number> = {
    'debug': 0,
    'info': 1,
    'warn': 2,
    'error': 3,
    'none': 4
};

export class Logger {
    private static currentLevel: number = LEVELS.error; // Default to error only

    static setLevel(level: LogLevel) {
        this.currentLevel = LEVELS[level];
    }

    static debug(message?: any, ...optionalParams: any[]) {
        if (this.currentLevel <= LEVELS.debug) {
            console.debug(message, ...optionalParams);
        }
    }

    static info(message?: any, ...optionalParams: any[]) {
        if (this.currentLevel <= LEVELS.info) {
            console.log(message, ...optionalParams);
        }
    }

    static warn(message?: any, ...optionalParams: any[]) {
        if (this.currentLevel <= LEVELS.warn) {
            console.warn(message, ...optionalParams);
        }
    }

    static error(message?: any, ...optionalParams: any[]) {
        if (this.currentLevel <= LEVELS.error) {
            console.error(message, ...optionalParams);
        }
    }
}
