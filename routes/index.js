var express = require('express');
var router = express.Router();
var mongo = require("../mongo.js");
var instaSessionController = require("../instaSessionController.js");
var Client = require('instagram-private-api').V1;
var Promise = require('bluebird');
var assert = require("assert");
var username;
var page = "General";

/* GET home page. */
router.get('/', function(req, res, next)
{
	mongo(function(db)
	{
		if(req.query.user)
		{
			username = req.query.user;
		}
		if(req.query.page)
		{
			page = req.query.page;
		}
		var accounts = db.collection("accounts");
		accounts.find().toArray(function(error, data)
		{
			assert.equal(null, error);
			accounts.findOne({username: username}, function(error, user)
			{
				assert.equal(null, error);
				if(user)
				{
					if(page == "General")
					{
						instaSessionController.getSession(username, function(instaSession)
						{
							if(instaSession._device)
							{
								instaSession.getAccount().then(function(account)
								{
									res.render('index', { users: data, user: user, account: account.params, page: page });
								})
							}
							else
							{
								res.render('index', { users: data, user: user, error: instaSession, page: page });
							}
						})
					}
					else
					{
						res.render('index', { users: data, user: user, page: page });
					}
				}
				else
				{
					res.render('index', { users: data, user: "none", page: page });
				}
			});

		});
	});
});

/* GET home page. */
router.get('/login', function(req, res, next)
{
	mongo(function(db)
	{
		if(req.query.user)
		{
			username = req.query.user;
			//if user is in the query, set it to username var
		}
		if(req.query.page)
		{
			page = req.query.page;
			//if page is in the query, set it to page var
		}
		var accounts = db.collection("accounts");
		accounts.find().toArray(function(error, data)
			//find all acount, put them in array
		{
			assert.equal(null, error);
			//???

			accounts.findOne({username: username}, function(error, user)
			{
				assert.equal(null, error);
				if(user) //if user is in the query
				{
					if(page == "General")
					{
						instaSessionController.getSession(username, function(instaSession)
							//call getSession with user and instaSession callback
						{
							if(instaSession._device) //return of instaSession??
							{
								instaSession.getAccount().then(function(account)//??
								{
									//render index view with data account.params
									res.render('index', { users: data, user: user, account: account.params, page: page });
								})
							}
							else
							{
								//render index view with eeror instaSession
								res.render('index', { users: data, user: user, error: instaSession, page: page });
							}
						})
					}
					else
					{
						//render index view with general page?
						res.render('index', { users: data, user: user, page: page });
					}
				}
				else
				{
					//render index view with no user
					res.render('index', { users: data, user: "none", page: page });
				}
			});

		});
	});

});

module.exports = router;
