var colors = require('colors');

var CommandFunc = function (ServerManager)
{
    this.serverManager = ServerManager;
    this.signature = null;
    this.commandName = null;
    this.commandDescription = null;
    this.commandUsage = null;
    this.arguments = [];
};

/**
 * @return {ServerManagerFunc}
 */
CommandFunc.prototype.getServerManager = function ()
{
    return this.serverManager;
};

/**
 * @param {string} signature
 *
 * @return {boolean}
 */
CommandFunc.prototype.shouldDispatch = function(signature)
{
    return signature === this.signature;
};

/**
 * @param arg
 * @private
 */
CommandFunc.prototype._dispatch = function (arg)
{
    this.arguments = arg;

    if (arg.length > 0 && 'help' === arg[0]) {
        return console.log('Usage ' + colors.yellow(this.usage));
    }

    this.dispatch();
};

/**
 * @param {int} nth
 *
 * @return {string}
 */
CommandFunc.prototype.getArgument = function (nth)
{
    if (this.arguments.length >= nth) {
        return this.arguments[nth - 1];
    }

    return null;
};

/**
 * @param {string} error
 */
CommandFunc.prototype.error = function (error)
{
    console.log(colors.red('Error: ' + error));
};

module.exports = CommandFunc;