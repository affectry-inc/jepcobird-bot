/*~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
           ______     ______     ______   __  __     __     ______
          /\  == \   /\  __ \   /\__  _\ /\ \/ /    /\ \   /\__  _\
          \ \  __<   \ \ \/\ \  \/_/\ \/ \ \  _"-.  \ \ \  \/_/\ \/
           \ \_____\  \ \_____\    \ \_\  \ \_\ \_\  \ \_\    \ \_\
            \/_____/   \/_____/     \/_/   \/_/\/_/   \/_/     \/_/


This is a sample Slack bot built with Botkit.

This bot demonstrates many of the core features of Botkit:

* Connect to Slack using the real time API
* Receive messages based on "spoken" patterns
* Reply to messages
* Use the conversation system to ask questions
* Use the built in storage system to store and retrieve information
  for a user.

# RUN THE BOT:

  Get a Bot token from Slack:

    -> http://my.slack.com/services/new/bot

  Run your bot from the command line:

    token=<MY TOKEN> node slack_bot.js

# USE THE BOT:

  Find your bot inside Slack to send it a direct message.

  Say: "Hello"

  The bot will reply "Hello!"

  Say: "who are you?"

  The bot will tell you its name, where it is running, and for how long.

  Say: "Call me <nickname>"

  Tell the bot your nickname. Now you are friends.

  Say: "who am I?"

  The bot will tell you your nickname, if it knows one for you.

  Say: "shutdown"

  The bot will ask if you are sure, and then shut itself down.

  Make sure to invite your bot into other channels using /invite @<my bot>!

# EXTEND THE BOT:

  Botkit has many features for building cool and useful bots!

  Read all about it here:

    -> http://howdy.ai/botkit

~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~*/

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('./lib/Botkit.js');
var os = require('os');

var controller = Botkit.slackbot({
    json_file_store: './db/jepcobird_bot/',
    debug: false
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

controller.hears('^(sushi|すし|スシ|寿司)$', 'direct_message,direct_mention,mention', function(bot, message) {
    bot.reply(message, '僕も寿司が好きです');
});

controller.hears('(天気は？|天気教えて|天気を教えて|天気わかる？)', 'direct_message,direct_mention', function(bot, message) {
    console.dir(message);
    var text = message['text'];
    var day = 0;
    var city_id = 0;

    if (text.match(/明日/)){
        day = 1;
    } else if (text.match(/明後日/)) {
        day = 2;
    }

    city_id = cityIdOf(text);
    if (city_id > 0) {
        weatherHacks(day, city_id, function(reply){
            bot.reply(message, reply);
        });
    } else {
        bot.startConversation(message, function(err, convo) {
            if (!err) {
                convo.ask('どこの天気？', function(response, convo) {
                    city_id = cityIdOf(response.text);
                    if (city_id > 0) {
                        convo.next();
                    } else {
                        convo.stop();
                    };
                });

                convo.on('end', function(convo) {
                    if (convo.status == 'completed') {
                        weatherHacks(day, city_id, function(reply){
                            bot.reply(message, reply);
                        });
                    } else {
                        bot.reply(message, 'どこそれ？知らないから自分で調べて。');
                    }
                });
            }
        });
    }
});

function cityIdOf(text) {
    if (text.match(/(東京|港区|中央区|新宿|渋谷|赤坂)/)){
        city_id = 130010;
    } else if (text.match(/(神奈川|横浜)/)){
        city_id = 140010;
    } else if (text.match(/大阪/)) {
        city_id = 270000;
    } else if (text.match(/京都/)) {
        city_id = 260010;
    } else if (text.match(/(愛知|名古屋)/)) {
        city_id = 230010;
    } else if (text.match(/(沖縄|那覇)/)) {
        city_id = 471010;
    } else {
        city_id = -1;
    }
    return city_id;
};

function weatherHacks(day, city_id, callback) {
    var reply = '';
    var request = require('request');
    var options = {
      url : 'http://weather.livedoor.com/forecast/webservice/json/v1?city=' + city_id,
      json: true
    }

    request.get(options, function (error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log(body);

        var title   = body['title'];
        var text    = body['description']['text'];
        var link    = body['link'];
        var weather = body['forecasts'][day];

        if (!weather) {
          callback({'text': '天気わかんないや。へへ'});
          return
        }

        var attachments = [{
            'fallback': 'Display weather from Weather Hacks',
            'title': title,
            'title_link': link,
            'text': text,
            'image_url': weather['image']['url'],
            'color': "#7CD197"
        }];

        reply = {
          'text': weather['dateLabel'] + 'の' + title + 'は' + weather['telop'] + 'だってさ。',
          'attachments': attachments
        };
      } else {
        console.log('error: '+ response.statusCode);
        reply = {
          'text': '天気わかんなかった。。へへ'
        };
      };
      callback(reply);
    });
};

controller.hears('', 'mention', function(bot, message) {
    bot.reply(message, '呼んだ？');
});

controller.hears('自己紹介', 'direct_mention', function(bot, message) {
    bot.reply(message, 'おいらはJepcobirdだお。');
});

controller.hears(['hello', 'hi'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.api.reactions.add({
        timestamp: message.ts,
        channel: message.channel,
        name: 'robot_face',
    }, function(err, res) {
        if (err) {
            bot.botkit.log('Failed to add emoji reaction :(', err);
        }
    });


    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Hello ' + user.name + '!!');
        } else {
            bot.reply(message, 'Hello.');
        }
    });
});

controller.hears(['call me (.*)', 'my name is (.*)'], 'direct_message,direct_mention,mention', function(bot, message) {
    var name = message.match[1];
    controller.storage.users.get(message.user, function(err, user) {
        if (!user) {
            user = {
                id: message.user,
            };
        }
        user.name = name;
        controller.storage.users.save(user, function(err, id) {
            bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
        });
    });
});

controller.hears(['what is my name', 'who am i'], 'direct_message,direct_mention,mention', function(bot, message) {

    controller.storage.users.get(message.user, function(err, user) {
        if (user && user.name) {
            bot.reply(message, 'Your name is ' + user.name);
        } else {
            bot.startConversation(message, function(err, convo) {
                if (!err) {
                    convo.say('I do not know your name yet!');
                    convo.ask('What should I call you?', function(response, convo) {
                        convo.ask('You want me to call you `' + response.text + '`?', [
                            {
                                pattern: 'yes',
                                callback: function(response, convo) {
                                    // since no further messages are queued after this,
                                    // the conversation will end naturally with status == 'completed'
                                    convo.next();
                                }
                            },
                            {
                                pattern: 'no',
                                callback: function(response, convo) {
                                    // stop the conversation. this will cause it to end with status == 'stopped'
                                    convo.stop();
                                }
                            },
                            {
                                default: true,
                                callback: function(response, convo) {
                                    convo.repeat();
                                    convo.next();
                                }
                            }
                        ]);

                        convo.next();

                    }, {'key': 'nickname'}); // store the results in a field called nickname

                    convo.on('end', function(convo) {
                        if (convo.status == 'completed') {
                            bot.reply(message, 'OK! I will update my dossier...');

                            controller.storage.users.get(message.user, function(err, user) {
                                if (!user) {
                                    user = {
                                        id: message.user,
                                    };
                                }
                                user.name = convo.extractResponse('nickname');
                                controller.storage.users.save(user, function(err, id) {
                                    bot.reply(message, 'Got it. I will call you ' + user.name + ' from now on.');
                                });
                            });



                        } else {
                            // this happens if the conversation ended prematurely for some reason
                            bot.reply(message, 'OK, nevermind!');
                        }
                    });
                }
            });
        }
    });
});


controller.hears(['shutdown'], 'direct_message,direct_mention,mention', function(bot, message) {

    bot.startConversation(message, function(err, convo) {

        convo.ask('Are you sure you want me to shutdown?', [
            {
                pattern: bot.utterances.yes,
                callback: function(response, convo) {
                    convo.say('Bye!');
                    convo.next();
                    setTimeout(function() {
                        process.exit();
                    }, 3000);
                }
            },
        {
            pattern: bot.utterances.no,
            default: true,
            callback: function(response, convo) {
                convo.say('*Phew!*');
                convo.next();
            }
        }
        ]);
    });
});


controller.hears(['uptime', 'identify yourself', 'who are you', 'what is your name'],
    'direct_message,direct_mention,mention', function(bot, message) {

        var hostname = os.hostname();
        var uptime = formatUptime(process.uptime());

        bot.reply(message,
            ':robot_face: I am a bot named <@' + bot.identity.name +
             '>. I have been running for ' + uptime + ' on ' + hostname + '.');

    });

function formatUptime(uptime) {
    var unit = 'second';
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'minute';
    }
    if (uptime > 60) {
        uptime = uptime / 60;
        unit = 'hour';
    }
    if (uptime != 1) {
        unit = unit + 's';
    }

    uptime = uptime + ' ' + unit;
    return uptime;
}
