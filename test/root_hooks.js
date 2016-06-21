"use strict";

const chai = require('chai');
const app = require('../app');
const expect = chai.expect;

let server;

before(done => {
  return app.up().then(_server => {
    server = _server;
    done();
  });
});

after(() => {
  server.close();
});

describe('app', () => {
  describe('up', () => {
    it('is a function', () => {
      expect(app.up).to.be.an.instanceof(Function);
    });
  });
});
