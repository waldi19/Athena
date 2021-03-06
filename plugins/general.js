const { check_perms } = require('../utils/permissions');
const path = require('path');
const fs = require('fs');
const log = require('../utils/logging');
const util = require('util');

/* eslint-disable require-jsdoc */
function exec(bot, event, irc, args) {
    let cprocess = require('child_process').exec(args.join(' '), { shell: '/bin/bash' });

    bot.config.processes.push(cprocess);
    let outpart = '';

    function send(data='') {
        data = (outpart + data).split('\n');
        outpart = data[data.length - 1];
        for (let i = 0; i < data.length - 1; i++) irc.reply(event, data[i]);
    }
    cprocess.stdout.on('data', send);
    cprocess.stderr.on('data', send);
    cprocess.on('exit', (code, signal) => {
        if (outpart !== '') {
            irc.reply(event, outpart);
            outpart = '';
        }
        irc.reply(event, `Process's exit code is ${signal || code}`);
    });
    cprocess.on('error', () => irc.reply(event, 'Error while running process'));
    cprocess.on('close', () => {
        bot.config.processes.splice(bot.config.processes.indexOf(cprocess), 1);
    });
}
exec.opts = {
    perms: [true, true, true]
};

function killprocess(bot, event, irc, args) {
    let oldest = bot.config.processes.pop();

    if (oldest) {
        oldest.kill();
    }
    irc.reply(event, 'Done');
}
killprocess.opts = {
    perms: [true, true, true]
};

function reload(bot, event, irc, args) {
    if (args.length) {
        for (let i of args) {
            const fpath = path.join('..', 'plugins', i);

            delete require.cache[require.resolve(fpath)];
            const plugin = require(fpath);

            bot.plugins.loadplugin(plugin);
        }
        irc.reply(event, 'Reloaded');
    } else {
        bot.plugins.loadPluginDir();
        delete require.cache[require.resolve('../core.js')];
        const core = (require('../core.js'))();

        core.init(bot.events, bot.config, bot.state);
        irc.reply(event, 'Reloaded');
    }
}
reload.opts = {
    perms: [true, true, true]
};

function shrug(bot, event, irc, args) {
    irc.reply(event, '¯\\_(ツ)_/¯');
}
shrug.opts = {};

function raw(bot, event, irc, args) {
    irc.send(args.join(' '));
}
raw.opts = {
    perms: [false, true, true]
};

function flush(bot, event, irc, args) {
    if (args.length) {
        bot.floodProtection.flushTarget(args[0]);
    } else {
        bot.floodProtection.flushAll();
    }
}
flush.opts = {
    perms: [false, true, true],
    min_args: 0,
    aliases: ['flushq']
};

function todo(bot, event, irc, args) {
    let has_perms = check_perms(bot.config, event.source.host, event.target, [true, false, false]);

    if (bot.todo === undefined) bot.todo = require('../todo.json');
    if (args[0] === 'add' && has_perms) {
        irc.reply(event, `Added to the todo list. No. ${bot.todo.push(args.slice(1).join(' '))}`);
    } else if ((args[0] === 'remove' || args[0] === 'done') && has_perms) {
        let index = parseInt(args[1]) - 1; // Parse args[1] and substract 1 to get the Array index
        let text = '';

        for (let i of bot.todo[index]) {
            text += `\u0336${i}`;
        }
        text += '- Done!';
        bot.todo[index] = text;
        irc.reply(event, `Removed ${args[1]} from todo list`);
    } else if (args[0] === 'save') {
        fs.writeFile(path.join(__dirname, '..', 'todo.json'), `${JSON.stringify(bot.todo, null, 2)}\n`, err => {
            if (err) {
                log.error('An error occured while saving file');
                log.error(err.stack);
            } else {
                irc.reply(event, 'ToDo saved!');
            }
        });
    } else {
        irc.reply(event, 'To-do List:');
        if (bot.todo.length === 0) {
            irc.reply(event, 'Empty');

            return;
        }
        for (let i of Object.entries(bot.todo)) {
            irc.reply(event, `${parseInt(i[0])+1}. ${i[1]}`);
        }
    }
}

todo.opts = {
    min_args: 0,
    category: 'general'
};

function ping(bot, event, irc, args) {
    irc.reply(event, 'Pong');
}

ping.opts = {
    min_args: 0,
    category: 'general'
};

function join(bot, event, irc, args) {
    irc.join(args[0], args[1]);
}
join.opts = {
    perms: [false, true, true],
    min_args: 1,
    category: 'general'
};


function quit(bot, event, irc, args) {
    irc.quit(args.join(' ') || 'Athena - https://github.com/BWBellairs/Athena');
}

quit.opts = {
    perms: [false, true, true],
    min_args: 0,
    category: 'general'
};

function Eval(bot, event, irc, args) {
    try {
        let result = eval(args.join(' '));

        util.inspect(result).split('\n').forEach(line => irc.reply(event, line));
    } catch (e) {
        irc.reply(event, `${e.name} ${e.message}`);
    }
}

function list(bot, event, irc, args) {
    if (args.length === 0) {
        // TODO use colours util to create bolded text
        irc.reply(event, `\x02Categories:\x0f ${bot.plugins.categories.join(', ')}`);
    } else {
        let commands = Object.keys(bot.plugins.commands).filter(x => {
            let is_right_category = bot.plugins.commands[x].opts.category.toLowerCase() === args[0];

            return !bot.plugins.commands[x].opts.hide && is_right_category;
        }).join(', ');

        irc.reply(event, `\x02Commands in ${args[0].replace(/\W/g, '')}:\x0f ${commands}`);
    }
}

list.opts = {
    min_args: 0,
    category: 'general'
};

Eval.opts = {
    perms: [false, false, true],
    min_args: 1,
    category: 'general'
};

module.exports = {
    exec,
    reload,
    shrug,
    raw,
    flush,
    todo,
    ping,
    quit,
    eval: Eval,
    list,
    join
};
