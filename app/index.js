"use strict";

const _ = require('lodash');
const path = require('path');
const bodyParser = require('body-parser');
const express = require('express');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const knex = require('knex');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const handlebars = require('express-handlebars');
const flash = require('connect-flash');

const ENV = process.env.NODE_ENV || 'development';

const config = require('../knexfile');
const db = knex(config[ENV]);

// Initialize Express.
const app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.use(session({ secret: 'some secret' }));
app.use(flash());
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());

app.engine('handlebars', handlebars({
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, '/views/layouts')
}));
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'handlebars');

// Configure & Initialize Bookshelf & Knex.
console.log(`Running in environment: ${ENV}`);

// ***** Models ***** //

const Comment = require('./models/comment');
const Post = require('./models/post');
const User = require('./models/user');

/// ***** Passport Strategies & Helpers ***** //

passport.use(new LocalStrategy((username, password, done) => {
  User
    .forge({ username: username })
    .fetch()
    .then((usr) => {
      if (!usr) {
        return done(null, false, { message: 'Incorrect username.' });
      }
      usr.validatePassword(password).then((valid) => {
        if (!valid) {
          return done(null, false, { message: 'Invalid password.' });
        }
        return done(null, usr);
      });
    })
    .catch((err) => {
      return done(err);
    });
}));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(user, done) {
  User
    .forge({id: user})
    .fetch({
      withRelated: ['followers', 'following']
    })
    .then((usr) => {
      done(null, usr);
    })
    .catch((err) => {
      done(err);
    });
});

const isAuthenticated = (req, res, done) => {
  if (req.isAuthenticated()) {
    return done();
  }
  res.redirect('/login');
};

// ***** Server ***** //

app.get('/user/:id', isAuthenticated, (req,res) => {
  User
    .forge({id: req.params.id})
    .fetch()
    .then((usr) => {
      if (_.isEmpty(usr))
        return res.sendStatus(404);
      res.send(usr);
    })
    .catch((error) => {
      console.error(error);
      return res.sendStatus(500);
    });
});

app.post('/user', (req, res) => {
  const { body } = req;

  if (!body.username || !body.password || !body['confirm-password']) {
    req.flash('error', 'All fields are required!');
    return res.redirect('/signup');
  }

  if (body.password !== body['confirm-password']) {
    req.flash('error', 'Password did not match confirmation!');
    return res.redirect('/signup');
  }

  delete body['confirm-password'];

  User
    .forge(req.body)
    .save()
    .then((usr) => {
      res.send({id: usr.id});
    })
    .catch((error) => {
      console.error(error);
      req.flash('error', error.message);
      return res.sendStatus(500);
    });
});

app.get('/posts', isAuthenticated, (req, res) => {
  Post
    .collection()
    .fetch()
    .then((posts) => {
      res.send(posts);
    })
    .catch((error) => {
      res.sendStatus(500);
    });
});

app.get('/post/:id', isAuthenticated, (req,res) => {
  Post
    .forge({id: req.params.id})
    .fetch({withRelated: ['author', 'comments']})
    .then((post) => {
      if (_.isEmpty(post))
        return res.sendStatus(404);
      res.send(post);
    })
    .catch((error) => {
      console.error(error);
      return res.sendStatus(500);
    });
});

app.post('/post', isAuthenticated, (req, res) => {
  if(_.isEmpty(req.body))
    return res.sendStatus(400);
  Post
    .forge(req.body)
    .save()
    .then((post) => {
      res.send({id: post.id});
    })
    .catch((error) => {
      console.error(error);
      return res.sendStatus(500);
    });
});

app.post('/comment', isAuthenticated, (req, res) => {
  if (_.isEmpty(req.body))
    return res.sendStatus(400);
  Comment
    .forge(req.body)
    .save()
    .then((comment) => {
      res.send({id: comment.id});
    })
    .catch((error) => {
      console.error(error);
      res.sendStatus(500);
    });
});

app.get('/follow/:id', isAuthenticated, (req, res) => {
  if (_.isEmpty(req.params))
    return res.sendStatus(400);
  let currUserId = req.user.id;
  let userToFollowId = req.params.id;
  User
    .forge({id: userToFollowId})
    .fetch()
    .then((usr) => {
      if (!usr)
        return res.sendStatus(400);
      return User.forge({id: currUserId}).following().attach([usr]);
    })
    .then((usr) => {
      res.send(_.pluck(usr.models, 'id'));
    })
    .catch((error) => {
      console.error(error);
      res.sendStatus(500);
    });
});

app.get('/unfollow/:id', isAuthenticated, (req, res) => {
  if (_.isEmpty(req.params))
    return res.sendStatus(400);
  let currUserId = req.user.id;
  let userToUnfollowId = req.params.id;
  User
    .forge({id: currUserId})
    .following()
    .detach([userToUnfollowId])
    .then((following) => {
      res.end();
    })
    .catch((error) => {
      console.error(error);
      res.sendStatus(500);
    });
});

app.get('/', isAuthenticated, (req, res) => {
  const followedIds = _.pluck(req.user.related('following').models, 'id');
  let queryObj = {};
  followedIds.forEach((id, idx) => {
    queryObj[(idx === 0) ? 'where' : 'orWhere'] = {'author' : id};
  });
  Post
    .query(queryObj)
    .orderBy('-created_at')
    .fetchAll({withRelated: ['author']})
    .then((results) => {
      res.send(results);
    })
    .catch((error) => {
      console.error(error);
      res.sendStatus(500);
    });
});

app.get('/login', (req, res) => {
  res.render('login', { message: req.flash('error') });
});

app.post('/login', passport.authenticate('local', {
  failureRedirect: '/login',
  failureFlash: true
}), function(req, res) {
  res.redirect('/posts');
});

app.get('/signup', (req, res) => {
  res.render('signup', { message: req.flash('error') });
});

// Exports for Server Hoisting.

const listen = (port) => {
  return new Promise((resolve, reject) => {
    return resolve(app.listen(port));
  });
};

exports.up = (justBackend) => {
  return db.migrate.latest([ENV])
    .then(() => {
      return db.migrate.currentVersion();
    })
    .then((val) => {
      console.log('Done running latest migration:', val);
      return listen(3000);
    })
    .then((server) => {
      console.log('Listening on port 3000...');
      return server
    });
};
