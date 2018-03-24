const { promisify } = require('util');
const cradle = require('cradle');

module.exports = {
  getTeamMatches: async (dbname, teamNumber, teamevent) => {
    const db = new (cradle.Connection)('http://35.230.125.220', 5984, {
      auth: { username: 'team4334', password: 'albertatechalliance' }
    }).database(dbname);
    const matches = await Promise.all(
      teamevent.matches
        .map(match => match.match(/qm(\d+)/))
        .filter(match => !!match)
        .map(match => match[1])
        .filter(match => !!match)
        .map((match) => {
          return new Promise((resolve, reject) => {
            db.get(`q${match}_${teamNumber}`, function (err, doc) {
              if (err) { resolve(null); } else { resolve(doc); }
            });
          });
        }));

    return {
      matches: matches.filter(m => !!m),
    };
  },

  getTeamPit: async (dbname, teamNumber) => {
    const db = new (cradle.Connection)('http://35.230.125.220', 5984, {
      auth: { username: 'team4334', password: 'albertatechalliance' }
    }).database(dbname);
    return new Promise((resolve, reject) => {
      db.get(`pit_${teamNumber}`, function (err, doc) {
        if (err) { reject(err); return; }

        Promise.all(Object.keys(doc._attachments).map(att => {
          return new Promise((r, j) => {
            db.getAttachment(`pit_${teamNumber}`, att, function (err, reply) {
              r(reply.body.toString('base64'));
            });
          });
        }))
          .then(attachments => {
            delete doc._attachments;
            resolve({
              ...doc,
              attachments,
            });
          });
      });
    });
  },
};
