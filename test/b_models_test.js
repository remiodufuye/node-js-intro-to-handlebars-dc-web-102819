"use strict";

const _      = require('lodash');
const expect = require('unexpected');
const bcrypt = require('bcrypt');

const User = require('../app/models/user');
const Posts = require('../app/models/post');
const Comments = require('../app/models/comment');

const db = require('../app/db/bookshelf');

let mockUser = {
  name: 'Sally Low',
  username: 'sally',
  email: 'sally@example.org',
  password: 'password',
};

let anotherMockUser = {
  name: 'Bob Saltwater',
  username: 'bob',
  email: 'bob@example.org',
  password: 'password',
};

let aThirdMockUser = {
  name: 'Johnny Auslander',
  username: 'johnny',
  email: 'johnny@example.org',
  password: 'password',
};

let mockPost = {
  title: 'My Test Post',
  body: 'This is just a test post with no real content.',
};

let mockComment = {
  body: 'This is a test comment.',
};

const checkHash = (hash) => {
  return new Promise((resolve, reject) => {
    bcrypt.compare(mockUser.password, hash, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
  });
};


describe('Models', () => {

  let transaction;

  beforeEach((done) => {
    return db.transaction((trx) => {
      transaction = trx;
      return done();
    }).catch(err => { return; });
  });

  afterEach(() => {
    transaction.rollback().catch(err => { return; });
  });

  it('User models exist', (done) => {
    expect(User, 'to be defined');
    done();
  });

  it('User model can save a user', (done) => {
    User
      .forge()
      .save(mockUser, {transacting: transaction})
      .catch((err) => { done(err) })
      .then((usr) => {
        expect(usr.attributes, 'to have keys', [
          'name',
          'email',
          'username',
          'password',
        ]);
        expect(usr.get('name'), 'to be', mockUser.name);
        expect(usr.get('email'), 'to be', mockUser.email);
        expect(usr.get('username'), 'to be', mockUser.username);
        checkHash(usr.get('password')).then((result) => {
          expect(result, 'to be', true);
          done();
        }).catch(err => { done(err); });
      });
  });

  it('User model can record a follower', (done) => {
    const saveUsr = (data) => {
      return User.forge().save(data, {transacting: transaction});
    };
    Promise.all([
      saveUsr(mockUser),
      saveUsr(anotherMockUser),
      saveUsr(aThirdMockUser)
    ])
      .then((results) => {
        let usr1 = results[0];
        let usr2 = results[1];
        let usr3 = results[2];
        return usr1.followers().attach(
          [usr2.id, usr3.id],
          {transacting: transaction}
        );
      })
      .then((usr) => {
        return User
          .forge({username: mockUser.username})
          .fetch({
            withRelated: ['followers'],
            transacting: transaction
          });
      })
      .then((usr) => {
        expect(usr.related('followers').length, 'to be', 2);
        expect(usr.related('followers').pluck('name'), 'to contain',
          anotherMockUser.name,
          aThirdMockUser.name
        );
        return User
          .forge({username: anotherMockUser})
          .fetch({
            withRelated: ['following'],
            transacting: transaction
          });
      })
      .then((usr) => {
        expect(usr.related('following').length, 'to be', 1);
        expect(usr.related('following').pluck('name'), 'to contain',
          mockUser.name
        );
        done();
      })
      .catch((err) => { done(err); });
   });

  it('Posts model exists', (done) => {
    expect(Posts, 'to be defined');
    done();
  });

  it('Posts model can save a post', (done) => {
    mockPost.author = mockUser.id;
    User
      .forge()
      .save(mockUser, {transacting: transaction})
      .catch((err) => { done(err); })
      .then((usr) => {
        mockPost.author = usr.id;
        return Posts
          .forge()
          .save(mockPost, {transacting: transaction});
      })
      .then((post) => {
        expect(post.attributes, 'to have keys', [
          'title',
          'body',
          'id',
          'author',
        ]);
        done();
      });
  });

  it('Comments model exists', () => {
    expect(Comments, 'to be defined');
  });

  it('Comments model can save a comment on a post', (done) => {
    User.forge().save(mockUser, {transacting: transaction})
      .then((usr) => {
        mockPost.author = usr.id;
        return Posts.forge().save(mockPost, {transacting: transaction});
      })
      .then((post) => {
        mockComment.post_id = post.get('id');
        mockComment.user_id = post.get('author');
        return Comments.forge().save(mockComment, {transacting: transaction});
      })
      .then((comment) => {
        expect(comment.attributes, 'to have keys', [
          'id',
          'user_id',
          'post_id',
          'body',
          'created_at',
          'updated_at',
        ]);
        done();
      });
  });

});
