"use strict";
try{
    var config = require("./configuration");
}catch{
    var config = {
        log_level: "debug",
        log_format: "[<level>], [<module>], [<function>] : <message>"
    }
}
const username = require("os").userInfo().username;
const CallerModule = require("caller-module");


class Logger {

    log_level = {
        debug: 10,
        info: 20,
        warning: 30,
        error: 40,
        critical: 50
    };

    level = this.log_level.debug;

    constructor(logging_module = username, logging_level = config.log_level) {
        this.log_format = config.log_format.replace("<module>", logging_module);

        if (typeof (logging_level) == "string" && ["debug", "info", "warning", "error", "critical"].includes(logging_level.toLowerCase())) {
            this.level = this.log_level[logging_level.toLowerCase()];
        } else if (Number.isInteger(logging_level)) {
            this.level = logging_level;
        } else {
            throw new Error('logging_level can be either of ("debug", "info", "warning", "error", "critical") or an integer value.')
        }
    }

    log({ log_level, level_tag, caller }) {
        // console.log(arguments)
        if (log_level >= this.level) {
            let message = this.format(level_tag, caller, arguments[1]);
            console.log(message);
            for (let i = 1; i < arguments[2].length; i++) {
                console.log(arguments[2][i]);
            }
        }
    }

    format(level, func, message) {
        return this.log_format.replace("<level>", level).replace("<function>", func).replace("<message>", message);
    }

    getCaller(self) {
        return CallerModule.GetCallerModule(3).callSite.getFunctionName();
    }

    debug(message) {
    
        this.log({ log_level: this.log_level.debug, level_tag: "DEBUG", caller: this.getCaller(this) }, message, arguments);
    }

    info(message) {

        this.log({ log_level: this.log_level.info, level_tag: "INFO", caller: this.getCaller(this) }, message, arguments);
    }

    warning(message) {

        this.log({ log_level: this.log_level.warning, level_tag: "WARNING", caller: this.getCaller(this) }, message, arguments);
    }

    error(message) {

        this.log({ log_level: this.log_level.error, level_tag: "ERROR", caller: this.getCaller(this) }, message, arguments);
    }

    critical(message) {

        this.log({ log_level: this.log_level.critical, level_tag: "CRITICAL", caller: this.getCaller(this) }, message, arguments);
    }
}

module.exports = {
    Logger,
}
