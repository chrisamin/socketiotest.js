#!/usr/bin/env node
/*jshint esnext: true */
"use strict";

const io = require('socket.io-client');
const url = require('url');
const minimist = require('minimist');
const OPTIONS = {
    u: "url",
    p: "path",
    w: "wait",
    t: "transport",
    l: "listen",
    s: "subscribe",
    h: "help",
    a: "allevents"
};

function showHelp() {
    console.log("Help:\n");
    for (var shortOpt in OPTIONS) {
        console.log("-" + shortOpt + ", --" + OPTIONS[shortOpt]);
    }
}

function handleError(error) {
    console.error(error);
    process.exit(1);
}

function parseOptions(argv) {
    const config = {};
    config.hostUrl = argv.url || "https://atlas-stream.ripe.net/stream/socket.io/";
    config.waitTime = parseInt(argv.wait || 0) * 1000;
    config.transport = argv.transport || "websocket";
    if (!Array.isArray(config.transport)) {
        config.transport = [config.transport];
    }
    config.path = argv.path || "/socket.io/";
    config.listenTo = argv.listen || [];
    if (!Array.isArray(config.listenTo)) {
        config.listenTo = [config.listenTo];
    }
    config.subscribeTo = argv.subscribe || [];
    if (!Array.isArray(config.subscribeTo)) {
        config.subscribeTo = [config.subscribeTo];
    }
    config.useWildcard = argv.allevents;
    return config;
}

function main() {
    process.on('uncaughtException', handleError);

    const argv = minimist(process.argv.slice(2), {
        alias: OPTIONS,
        boolean: ["allevents"]
    });
    const untrackedEvents = [];

    if (argv.help) {
        showHelp();
        process.exit(0);
    }

    const config = parseOptions(argv);

    var socket = io(config.hostUrl, {
        path: config.path,
        autoConnect: false,
        transports: config.transport,

    });
    if (config.useWildcard) {
        require('socketio-wildcard')(io.Manager)(socket);
    }

    function onEvent() {
        var args = Array.prototype.slice.call(arguments);
        var eventName= args.shift();
        console.log('EVENT', eventName, JSON.stringify(args));
    }

    function onWildcardEvent(event) {
        var eventName = event.data.shift();
        if (config.listenTo.indexOf(eventName) == -1) {
            if (untrackedEvents.indexOf(eventName) == -1) {
                console.log('UNTRACKED EVENT', eventName);
                untrackedEvents.push(eventName);
            }
        } else {
            console.log('EVENT', eventName, JSON.stringify(event.data));
        }
    }

    socket.on('connect', onEvent.bind(null, 'connect'));

    if (config.useWildcard) {
        socket.on('*', onWildcardEvent);
    } else {
        for (let i=0; i < config.listenTo.length; i++) {
            socket.on(config.listenTo[i], onEvent.bind(null, config.listenTo[i]));
        }
    }

    socket.open();

    for (let i=0, sub, pos, eventName, params; i < config.subscribeTo.length; i++) {
        sub = config.subscribeTo[i];
        pos = sub.indexOf(' ');
        if (pos != -1) {
            eventName = sub.slice(0, pos);
            params = JSON.parse(sub.slice(pos + 1));
        } else {
            params = null;
            eventName = sub;
        }
        
        console.log('SUBSCRIBE', eventName, JSON.stringify(params));
        socket.emit(eventName, params);
    }

    if (config.waitTime) {
        setTimeout(function() { socket.close(); }, config.waitTime);
    }
}

main();
