const request = require('request');
const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const YouTube = require("simple-youtube-api");
const fs = require("fs");
const google = require("googleapis");
const youtube = google.youtube("v3"); //var config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const bot = new Discord.Client();
const prefix = "##";
const botlogchannel = "406504806954565644";
const botmlogchannel = "409055298158985216";
const botbuglogchannel = "418642505509240836";
const boterrorchannel = "420955154695585792";
const botrejectionschannel = "432090416834412545";
const botowner = "264470521788366848";
var dispatcher;
const songQueue = new Map();
var currentSongIndex = 0;
var previousSongIndex = 0;
var shuffle = false;
var autoremove = false;
const firebase = require("firebase");

firebase.initializeApp({
    apiKey: process.env.FB_API_KEY,
    authDomain: process.env.FB_AUTH_DOMAIN,
    databaseURL: process.env.FB_DATABASE_URL,
    projectId: process.env.FB_PROJECT_ID,
    storageBucket: process.env.FB_STORAGE_BUCKET,
    messagingSenderId: process.env.FB_MESSAGING_SENDER_ID
});
firebase.auth().signInWithEmailAndPassword(process.env.FB_EMAIL, process.env.FB_PASSWORD);
const db = firebase.database();

bot.on("ready", function() {
    console.log("Music Bot ready");
    bot.channels.get(botlogchannel).send("Music bot ready");
});

bot.login(process.env.BOTTOKEN).then(function() {
    console.log("Music bot logged in");
    bot.user.setPresence({ status: `streaming`, game: { name: `${prefix}help | ${bot.guilds.size} Guilds`, type: `STREAMING`, url: `https://www.twitch.tv/pardeepsingh12365` } });
    bot.channels.get(botlogchannel).send("Music bot logged in");
}).catch(console.log);

bot.on("message", async(message) => {
    bot.user.setPresence({ status: `streaming`, game: { name: `${prefix}help | ${bot.guilds.size} Guilds`, type: `STREAMING`, url: `https://www.twitch.tv/pardeepsingh12365` } });

    if (message.author.bot) return undefined;
    const randomcolor = '0x' + Math.floor(Math.random() * 16777215).toString(16);

    if (message.channel.type == "dm" || message.channel.type == "group") return undefined;
    const gprefix = (await db
        .ref(`servers/${message.guild.id}`)
        .child('guildprefix')
        .once('value')).val();

    if (!message.content.startsWith(gprefix) && !message.content.startsWith(prefix)) return undefined;
    if (message.content.startsWith(gprefix)) {
        args = message.content.substring(gprefix.length + 1).split();
        comarg = message.content.slice(gprefix.length).trim().split(/ +/g);
    } else {
        args = message.content.substring(prefix.length + 1).split();
        comarg = message.content.slice(prefix.length).trim().split(/ +/g);
    }
    const command = comarg.shift().toLowerCase();


    if (command === "play" || command === "p" || command === "yt") {
        const youtube = new YouTube(process.env.GOOGLEAPIKEY);
        const voiceChannel = message.member.voiceChannel;
        let args0 = args.join("").substring(command.length);
        let searchString = args0.slice();
        const url = args0 ? args0.replace(/<(.+)>/g, '$1') : '';
        if (!voiceChannel) return message.channel.send("You are not in a voice channel please join a channel and use this command again");
        const permissions = voiceChannel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) return message.channel.send("I do not have the permissions to join that voice channel pleae give me permissions to join");
        if (!permissions.has("SPEAK")) return message.channel.send("I do not have the permissions to speak in that voice channel pleae give me permissions to join");
        if (url.match(/^https?:\/\/(www.youtube.com|youtube.com)\/playlist(.*)$/)) {
            const playlist = await youtube.getPlaylist(url);
            const videos = await playlist.getVideos();
            for (const video of Object.values(videos)) {
                const video2 = await youtube.getVideoByID(video.id);
                await addSong(message, video2, voiceChannel, true);
            }
            return message.channel.send(`✅ Playlist: **${playlist.title}** has been added to the queue!`);
        } else {
            try {
                var video = await youtube.getVideo(url);
            } catch (error) {
                try {
                    var videos = await youtube.searchVideos(searchString, 1);
                    //let index = 0;
                    /*message.channel.send(`
      __**Song selection:**__
      ${videos.map(video2 => `**${++index} -** ${video2.title}`).join('\n')}
      Please provide a value to select one of the search results ranging from 1-10.
                          `);
              try {
                var response = await message.channel.awaitMessages(message2 => message2.content > 0 && message2.content < 11, {
                  maxMatches: 1,
                  time: 10000,
                  errors: ['time']
                });
              } catch (err) {
                console.error(err);
                return message.channel.send('No or invalid value entered, cancelling video selection.');
              }*/
                    const videoIndex = 1 /*parseInt(response.first().content);*/
                    var video = await youtube.getVideoByID(videos[videoIndex - 1].id);
                } catch (err) {
                    bot.channels.get(boterrorchannel).send(`${message.author.tag} from ${message.guild.name} trying to use play command but i got a error ${err}`)
                    return message.channel.send('🆘 I could not obtain any search results.');
                }
            }
            return addSong(message, video, voiceChannel);
        }
    }

    if (command === "resume") {
        if (message.member.voiceChannel !== undefined) {
            if (!message.guild.me.voiceChannel) {
                message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
                return;
            }
            if (serverQueue && !serverQueue.playing) {
                serverQueue.playing = true;
                dispatcher.resume();
                return message.channel.send('▶ Resumed the music for you!');
            }
            return message.channel.send('There is nothing playing.');
        } else {
            message.channel.send("You can't resume music if you're not in a voice channel :cry:", { reply: message });
        }
    }

    if (command === "pause") {
        if (message.member.voiceChannel !== undefined) {
            if (!message.guild.me.voiceChannel) {
                message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
                return;
            }
            if (serverQueue && serverQueue.playing) {
                serverQueue.playing = false;
                dispatcher.pause();
                return message.channel.send('⏸ Paused the music for you!');
            }
            return message.channel.send('There is nothing playing.');
        } else {
            message.channel.send("You can't pause music if you're not in a voice channel :cry:", { reply: message });
        }
    }

    if (command === "prev") {
        if (message.member.voiceChannel !== undefined) {
            if (!message.guild.me.voiceChannel) {
                message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
                return;
            }
            if (serverQueue.songs.length > 0) {
                previousSongIndex = currentSongIndex;
                var amount = Number.parseInt(args[0]);
                if (Number.isInteger(amount)) {
                    currentSongIndex -= amount;
                } else {
                    currentSongIndex--;
                }
                if (currentSongIndex < 0) {
                    currentSongIndex = 0;
                }
                dispatcher.end("prev");
            } else {
                message.channel.send("There are no more songs :sob:", { reply: message });
            }
        } else {
            message.channel.send("You can't prev music if you're not in a voice channel :cry:", { reply: message });
        }
    }


    if (command === "skip" || command === "next" || command === "s") {
        if (message.member.voiceChannel !== undefined) {
            if (!message.guild.me.voiceChannel) {
                message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
                return;
            }
            if (serverQueue.songs.length > 0) {
                previousSongIndex = currentSongIndex;
                var amount = Number.parseInt(args[0]);
                if (Number.isInteger(amount)) {
                    currentSongIndex += amount;
                } else {
                    currentSongIndex++;
                }
                if (currentSongIndex > serverQueue.songs.length - 1) {
                    currentSongIndex = serverQueue.songs.length - 1;
                    serverQueue.songs = [];
                    currentSongIndex = 0;
                    message.member.voiceChannel.leave();
                    var finishembed = new Discord.RichEmbed()
                        .setColor(randomcolor)
                        .setAuthor("Finished playing because no more song in the queue", "https://cdn.discordapp.com/attachments/398789265900830760/405592021579989003/videotogif_2018.01.24_10.46.57.gif")
                        .setDescription("please add more song if you like 🎧")
                        .setFooter("Developed by: PK#1650 ", "https://cdn.discordapp.com/attachments/399064303170224131/405585474988802058/videotogif_2018.01.24_10.14.40.gif")
                        .setTimestamp();
                    message.channel.send({ embed: finishembed });
                }
                dispatcher.end("next");
            } else {
                message.channel.send("There are no more songs :sob:", { reply: message });
            }
        } else {
            message.channel.send("You can't hear my music if you're not in a voice channel :cry:", { reply: message });
        }
    }

    if (command === "goto") {
        if (message.member.voiceChannel !== undefined) {
            if (!message.guild.me.voiceChannel) {
                message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
                return;
            }
            if (serverQueue.songs.length > 0) {
                let arg = args.join("").substring(command.length);
                var index = Number.parseInt(arg);
                if (Number.isInteger(index)) {
                    previousSongIndex = currentSongIndex;
                    currentSongIndex = index - 1;
                    if (currentSongIndex < 0) {
                        currentSongIndex = 0;
                    } else if (currentSongIndex > serverQueue.length - 1) {
                        currentSongIndex = serverQueue.length - 1;
                    }
                    dispatcher.end("goto");
                } else {
                    message.channel.send(`\`${arg}\` is an invalid index`, { reply: message });
                }
            } else {
                message.channel.send("There are no more songs :sob:", { reply: message });
            }
        } else {
            message.channel.send("You can't hear my music if you're not in a voice channel :cry:", { reply: message });
        }
    }

    if (command === "random") {
        if (message.member.voiceChannel !== undefined) {
            if (!message.guild.me.voiceChannel) {
                message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
                return;
            }
            if (serverQueue.songs.length > 0) {
                currentSongIndex = Math.floor(Math.random() * serverQueue.songs.length);
                dispatcher.end("random");
            } else {
                message.channel.send("There are no more songs :sob:", { reply: message });
            }
        } else {
            message.channel.send("You can't hear my music if you're not in a voice channel :cry:", { reply: message });
        }
    }

    if (command === "stop") {
        if (message.member.voiceChannel !== undefined) {
            if (!message.guild.me.voiceChannel) {
                message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
                return;
            }
            if (serverQueue.songs.length === 0) {
                message.member.voiceChannel.leave();
                message.channel.send("There are no songs to clear and im leaving the voice", { reply: message });
            } else {
                dispatcher.end("stopping");
                currentSongIndex = 0;
                serverQueue.songs = [];
                message.member.voiceChannel.leave();
                var stopembed = new Discord.RichEmbed()
                    .setColor(randomcolor)
                    .setAuthor("Finished playing by stop command", "https://cdn.discordapp.com/attachments/398789265900830760/405592021579989003/videotogif_2018.01.24_10.46.57.gif")
                    .setDescription("thanks for using see you soon bye bye 👋")
                    .setFooter("Stoped by: " + message.author.username.toString(), message.author.displayAvatarURL)
                    .setTimestamp();
                message.channel.send({ embed: stopembed });
            }
        } else {
            message.channel.send("You can't stop music if you're not in a voice channel :cry:", { reply: message });
        }
    }

    if (command === "autoremove") {
        if (message.member.voiceChannel !== undefined) {
            if (autoremove) {
                autoremove = false;
                message.channel.send("Song autoremoval is now disabled", { reply: message });
            } else {
                autoremove = true;
                message.channel.send("Song autoremoval is now enabled", { reply: message });
            }
        } else {
            message.channel.send("You can't hear my music if you're not in a voice channel :cry:", { reply: message });
        }
    }

    if (command === "song" || command === "np" || command === "nowplaying") {
        if (!message.guild.me.voiceChannel) {
            message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
            return;
        }
        if (serverQueue.songs.length > 0) {
            var songembed = new Discord.RichEmbed()
                .setColor(randomcolor)
                .setAuthor(`The current song is \`${serverQueue.songs[currentSongIndex].title}\` 🎧`)
                .setDescription("link here: " + `[click](${serverQueue.songs[currentSongIndex].url})`)
                .setThumbnail(`${serverQueue.songs[currentSongIndex].thumbnail}`)
                .setFooter(`Added by ${serverQueue.songs[currentSongIndex].user}`, serverQueue.songs[currentSongIndex].usravatar)
                .setTimestamp();
            message.channel.send({ embed: songembed });
        } else {
            message.channel.send("No song is in the queue", { reply: message });
        }
    }

    if (command === "queue" || command === "q" || command === "playlist") {
        if (!message.guild.me.voiceChannel) {
            message.channel.send("bot is not in voice channel and nothing to play", { reply: message });
            return;
        }
        if (serverQueue.songs.length > 0) {
            var songList = "";
            for (var i = 0; i < serverQueue.songs.length; i++) {
                if (i === currentSongIndex) {
                    songList += `__**\`${i + 1}. ${serverQueue.songs[i].title}\`**__\n`;
                } else {
                    songList += `\`${i + 1}. ${serverQueue.songs[i].title}\`\n`;
                }
            }
            if (songList.length < 1950) {
                var queueembed = new Discord.RichEmbed()
                    .setColor(randomcolor)
                    .setAuthor("The song queue of " + message.guild.name + " currently has:", message.guild.iconURL == null ? "https://images-ext-1.discordapp.net/external/v1EV83IWPZ5tg7b5NJwfZO_drseYr7lSlVjCJ_-PncM/https/cdn.discordapp.com/icons/268683615632621568/168a880bdbc1cb0b0858f969b2247aa3.jpg?width=80&height=80" : message.guild.iconURL)
                    .setDescription(`${songList}`)
                    .setFooter("Developed by: PK#1650 ", "https://cdn.discordapp.com/attachments/399064303170224131/405585474988802058/videotogif_2018.01.24_10.14.40.gif")
                    .setTimestamp();
                message.channel.send({ embed: queueembed });
            } else {
                message.channel.send(`${songList}`, { split: "\n" });
            }
        } else {
            message.channel.send("No song is in the queue", { reply: message });
        }
    }

    if (command === "volume" || command === "sv" || command === "setvolume") {
        if (message.member.voiceChannel !== undefined) {
            if (!message.guild.me.voiceChannel) {
                message.channel.send("bot is not in voice channel", { reply: message });
                return;
            }
            let args2 = args.join("").substring(command.length);
            if (args2 > 100) {
                message.channel.send("Invalid Volume! Please provide a volume from 1 to 100.");
                return;
            }
            if (args2 < 1) {
                message.channel.send("Invalid Volume! Please provide a volume from 1 to 100.");
                return;
            }
            if (isNaN(args2)) {
                message.channel.send(args2);
                message.channel.send(`please provide a valid input. example \`${prefix}volume 100\``, { reply: message });
                return;
            }
            serverQueue.volume[message.guild.id] = args2;
            dispatcher.setVolumeLogarithmic(args2 / 80);
            var setvolembed = new Discord.RichEmbed()
                .setColor(randomcolor)
                .setAuthor("volume controls", "https://cdn.discordapp.com/attachments/398789265900830760/405592021579989003/videotogif_2018.01.24_10.46.57.gif")
                .setDescription(`volume set ${args2}%`)
                .setThumbnail("https://images-ext-1.discordapp.net/external/v1EV83IWPZ5tg7b5NJwfZO_drseYr7lSlVjCJ_-PncM/https/cdn.discordapp.com/icons/268683615632621568/168a880bdbc1cb0b0858f969b2247aa3.jpg?width=80&height=80")
                .setFooter("Changed by: " + message.author.username.toString(), message.author.displayAvatarURL)
                .setTimestamp();
            message.channel.send({ embed: setvolembed });
            bot.channels.get(botmlogchannel).send(`**${message.author.username}** using volume command in **${message.guild.name}** volume: **${args2}**`);
        } else {
            message.channel.send("you cant change volume if you are not in voice channel", { reply: message });
        }
    }
});

var addSong = function(message, video, voiceChannel, playlist = false) {
    const serverQueue = songQueue.get(message.guild.id);
    const song = {
        id: video.id,
        title: /*Util.escapeMarkdown(*/ video.title,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        duration: `${video.duration.hours}:${video.duration.minutes}:${video.duration.seconds}`,
        thumbnail: video.thumbnails.high.url,
        author: video.author = message.author,
        user: message.author.username,
        usravatar: message.author.displayAvatarURL
    };
    if (!serverQueue) {
        const queueConstruct = {
            textChannel: message.channel,
            voiceChannel: voiceChannel,
            connection: null,
            songs: [],
            volume: [],
            playing: true
        };
        songQueue.set(message.guild.id, queueConstruct);

        queueConstruct.songs.push(song);
    } else {
        serverQueue.songs.push(song);
        let Discord = require('discord.js');
        if (playlist) {
            if (!bot.voiceConnections.exists("channel", message.member.voiceChannel)) {
                message.member.voiceChannel.join().then(function(connection) {
                    playSong(message, connection);
                }).catch(err => bot.channels.get(boterrorchannel).send(`${message.author.username} from ${message.guild.name} play command and error in addsong \n${err}`)); //removed consol log
            }
            return
        } else {
            let embed = new Discord.RichEmbed()
                .setAuthor(`I have added \`${song.title}\` to the song queue!`, "https://cdn.discordapp.com/attachments/398789265900830760/405592021579989003/videotogif_2018.01.24_10.46.57.gif")
                .setDescription("link here: " + `[click](${song.url})`)
                .setColor(randomcolor)
                .setThumbnail(song.thumbnail)
                .addField("**Length**", song.duration, true)
                .addField("Requested by", song.author, true)
                .setFooter("Added by: " + message.author.username.toString(), message.author.displayAvatarURL)
                .setTimestamp()
            message.channel.send({ embed });
        }
    }
    if (!bot.voiceConnections.exists("channel", message.member.voiceChannel)) {
        message.member.voiceChannel.join().then(function(connection) {
            playSong(message, connection);
        }).catch(err => bot.channels.get(boterrorchannel).send(`${message.author.username} from ${message.guild.name} play command and error in addsong \n${err}`)); //removed consol log
    }
}

var playSong = function(message, connection) {
    const serverQueue = songQueue.get(message.guild.id);
    if (shuffle) {
        do {
            currentSongIndex = Math.floor(Math.random() * serverQueue.songs.length);
        } while (currentSongIndex === previousSongIndex);
    }

    var currentSong = serverQueue.songs[currentSongIndex];
    if (currentSong) {
        var stream = ytdl(currentSong.url, { "filter": "audioonly" });
        dispatcher = connection.playStream(stream, { volume: serverQueue.volume[message.guild.id] / 80 });
        var nowplayembed = new Discord.RichEmbed()
            .setColor(randomcolor)
            .setAuthor(`Now ${(shuffle) ? "randomly " : ""}playing \`${currentSong.title}\``, "https://cdn.discordapp.com/attachments/398789265900830760/405592021579989003/videotogif_2018.01.24_10.46.57.gif")
            .setDescription("link here: " + `[click](${currentSong.url})`)
            .setURL(`${currentSong.url}`)
            .setThumbnail(`${currentSong.thumbnail}`)
            .addField("**Length**", currentSong.duration, true)
            .addField("Requested by", currentSong.author, true)
            .setFooter("Requested by: " + `${currentSong.user}`, currentSong.usravatar)
            .setTimestamp();
        message.channel.send({ embed: nowplayembed });
        bot.channels.get(botmlogchannel).send(`**${message.author.tag}**` + ` playing ` + `\`\`${currentSong.title}\`\`` + ` in ` + `**${message.guild.name}**` + ` server`);
        dispatcher.player.on("warn", console.warn);
        dispatcher.on("warn", console.warn);
        dispatcher.on("error", console.error);
        dispatcher.once("end", function(reason) { //bot.channels.get(botlogchannel).send("Song ended because: " + reason);
            if (reason === "user" || reason === "Stream is not generating quickly enough.") {
                if (autoremove) {
                    serverQueue.splice(curre1ntSongIndex, 1);
                    if (serverQueue.songs.length === 0) {
                        message.member.voiceChannel.leave();
                    } else {
                        setTimeout(function() {
                            playSong(message, connection);
                        }, 500);
                    }
                } else {
                    currentSongIndex++;
                    if (currentSongIndex >= serverQueue.songs.length && !shuffle) {
                        message.member.voiceChannel.leave();
                        var finishembed = new Discord.RichEmbed()
                            .setColor(randomcolor)
                            .setAuthor("Finished playing because no more song in the queue", "https://cdn.discordapp.com/attachments/398789265900830760/405592021579989003/videotogif_2018.01.24_10.46.57.gif")
                            .setDescription("please add more song if you like 🎧")
                            .setFooter("Developed by: PK#1650 ", "https://cdn.discordapp.com/attachments/399064303170224131/405585474988802058/videotogif_2018.01.24_10.14.40.gif")
                            .setTimestamp();
                        message.channel.send({ embed: finishembed });
                    } else {
                        setTimeout(function() {
                            playSong(message, connection);
                        }, 500);
                    }
                }
            } else if (reason === "prev" || reason === "next" || reason === "goto" || reason === "random") {
                setTimeout(function() {
                    playSong(message, connection);
                }, 500);
            }
        });
    }
};
const randomcolor = '0x' + Math.floor(Math.random() * 16777215).toString(16);

function newFunction() {
    return queue.message.guild.id;
}
