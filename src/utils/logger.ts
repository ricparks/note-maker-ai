/*
 * Copyright (C) 2026 The Application Foundry, LLC
 *
 * This file is part of NoteMakerAI.
 *
 * NoteMakerAI is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * NoteMakerAI is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * =========================================================================
 *
 * COMMERCIAL LICENSE OPTION
 *
 * If you wish to use this software in a proprietary product or are unable
 * to comply with the terms of the AGPLv3, a commercial license is available.
 *
 * For commercial licensing inquiries, please contact: license@theapplicationfoundry.com
 *
 * =========================================================================
 */
/* eslint-disable no-console */
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

    static debug(message?: unknown, ...optionalParams: unknown[]) {
        if (this.currentLevel <= LEVELS.debug) {
            console.debug(message, ...optionalParams);
        }
    }

    static info(message?: unknown, ...optionalParams: unknown[]) {
        if (this.currentLevel <= LEVELS.info) {
            console.log(message, ...optionalParams);
        }
    }

    static warn(message?: unknown, ...optionalParams: unknown[]) {
        if (this.currentLevel <= LEVELS.warn) {
            console.warn(message, ...optionalParams);
        }
    }

    static error(message?: unknown, ...optionalParams: unknown[]) {
        if (this.currentLevel <= LEVELS.error) {
            console.error(message, ...optionalParams);
        }
    }
}
