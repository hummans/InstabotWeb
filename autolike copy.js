var Client = require('instagram-private-api').V1;
var _ = require('underscore');
var Promise = require('bluebird');
var mongo = require("./mongo.js");
var Log = require("./log.js");
var logger = new Log();
var todayLikeCount = 0;
var today = new Date();
var db;


var likeByTag = function(session, instaSession, sessionController)
{
  mongo(function(_db)
  {
    db = _db;
    var tagName = session.source;

    logger.log("tagname :" + tagName);
    var likeAmount = session.likeCount;
    logger.log("likeAmount :" + likeAmount);
    var username = session.creator;
    logger.log("username :" + username);
    var sessionId = session._id;
    logger.log("sessionId :" + sessionId);

    var feed = new Client.Feed.TaggedMedia(instaSession, tagName);
    var likeDelay = 0;

    logger.log("Account " + username + " : New like session started");

    db.collection("accounts").findOne({username: username}, function(error, userObj)
    {
      var settings = userObj.settings.autoLike;
      
      var running = userObj.settings.autoComment.running;
      var lowCommentFrequency = parseInt(userObj.settings.autoComment.lowCommentFrequency);
      var maxCommentFrequency = parseInt(userObj.settings.autoComment.maxCommentFrequency);
      //var commentList = userObj.settings.autoComment.commentList;

      /*commentData =
      {
        running: running,
        lowCommentFrequency: lowCommentFrequency,
        maxCommentFrequency: maxCommentFrequency,
        commentList: commentList,
        commentCounter: _.random(lowCommentFrequency, maxCommentFrequency)
      };*/
        var mediaArray = [];
        var medias = grabMedias(likeAmount, feed, mediaArray, 0, userObj.username, function(medias)
          {
            medias.forEach(function(media)
            {
              db.collection("sessions").update({_id: sessionId}, {$addToSet: {mediaList: media.params.webLink}});
              var partDelay = _.random(parseInt(settings.likeDelayMin), parseInt(settings.likeDelayMax)) * 1000;
              setTimeout(likeMedia, likeDelay, media, instaSession, username, sessionId, settings.dailyMaxLikeCount, sessionController);
              likeDelay += partDelay;
            });
        });
    });

  });
}


function grabMedias(mediaAmount, feed, mediaArray, mediaCount, username, callback)
{
    var more = true;
    Promise.map(_.range(0, 1), function()
    {
      return feed.get();
    }).then(function(medias)
    {
      for(var i = 0; i < medias[0].length; i++)
      {
        var media = medias[0][i];
        if(checkMedia(media, username))
        {
          mediaArray.push(media);
          mediaCount ++;
        }

        if(mediaCount >= mediaAmount)
        {
          more = false;
          callback(mediaArray);
          logger.log("Account " + username + " : Grabmedia: All medias should be OK")
          break;
        }
      }
      if(more)
      {
        grabMedias(mediaAmount, feed, mediaArray, mediaCount, username, callback);
      }
    })
}

function checkMedia(media, username)
{
  if(!media.params.hasLiked)
  {
    if(5 <= !media.params.likeCount <= 60)
    {
      //logger.log("Medis hasn't been liked and is between 5 and 60 likes, proceding")
      return true;
    }
    if(typeof media.params.webLink == "undefined"){
      logger.log("Undefined, next")
     return false;
    }
  }

  return false;
}

function likeMedia(media, instaSession, username, sessionId, commentData, dailyMaxLikeCount, sessionController)
{
  db.collection("accounts").findOne({username: username}, function(error, userObj)
  {
    if(userObj.settings.autoLike.running)
    {
      db.collection("sessions").findOne({_id: sessionId}, function(error, session)
      {
        if(session)
        {
          if(checkTodayLikes(dailyMaxLikeCount, username, sessionController))
          {
            db.collection("sessions").update({_id: sessionId}, {$pull: {mediaList: media.params.webLink}});
            db.collection("sessions").update({_id: sessionId}, {$inc: {likesDone: 1}});

            if(session.likesDone +1 >= session.likeCount)
            {
              logger.log("Account " + username + " : Like session done");
              db.collection("sessions").remove({_id: sessionId});

              logger.log("Account " + username + " : Creating new like session");
              sessionController.newLikeSession(username);
            }

            var test = Client.Like.create(instaSession, media.id);
            if(media.params.webLink == "undefined"){
              logger.log("Account " + username + " : Error While liking media" + media.params.webLink);
            }else{

            //logger.log("Account " + username + " : Liked page " + media.params.webLink);
            }
            todayLikeCount ++;
            //logger.log("Account " + username + " : DEBUG : " + test);

            if(commentData.running == "true")
            {
              commentData.commentCounter --;
              if(commentData.commentCounter <= 0)
              {
                var commentList = commentData.commentList.split("|");
                var comment = commentList[_.random(0, commentList.length - 1)];

                logger.log("Commented on " + media.params.webLink);

                Client.Comment.create(instaSession, media.id, comment);
                commentData.commentCounter = _.random(commentData.lowCommentFrequency, commentData.maxCommentFrequency);
              }
            }
          }
        }
      });
    }
    else
    {
      db.collection("sessions").remove({_id: sessionId});
    }
  });
}

function checkTodayLikes(dailyMaxLikeCount, username, sessionController)
{
  var date = new Date();

  if(sameDay(date, today))
  {
    if(todayLikeCount < dailyMaxLikeCount)
    {
      return true;
    }
  }
  else
  {
    today = new Date();
    todayLikeCount = 0;

    return true;
  }

  logger.log("Reached daily max likes on " + username);

  db.collection("accounts").update({username: username}, {$set: {"settings.autoLike.running": false}});
  sessionController.cleanLikeSession(username);
logger.log("Stopped autoLike " + username);

  setInterval(function()
  {
    var date = new Date();
    if(!sameDay(date, today))
    {
    	logger.log("It's a new day, it's a new dawn " + username);
    	today = new Date();
      db.collection("accounts").update({username: username}, {$set: {"settings.autoLike.running": true}});
      sessionController.newLikeSession(username);
      logger.log("Started autoLike " + username);
    }
  }, 5000);
  return false;
}

function sameDay(date1, date2)
{
  if(date1.getDay() == date2.getDay())
  {
    if(date1.getMonth() == date2.getMonth())
    {
      if(date1.getFullYear() == date2.getFullYear())
      {
        return true;
      }
    }
  }

  return false;
}

module.exports =
{
  likeByTag: likeByTag
}
