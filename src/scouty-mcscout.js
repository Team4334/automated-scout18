const { promisify } = require('util');
const cradle = require('cradle');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

const { TeamEvent } = require('./models');

module.exports = {
  getTeamMatches: async (dbname, teamNumber, teamevent) => {
    const db = new (cradle.Connection)('http://127.0.0.1', 5984, {
      auth: { username: 'username', password: 'password' }
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
    const db = new (cradle.Connection)('http://127.0.0.1', 5984, {
      auth: { username: 'username', password: 'password' }
    }).database(dbname);
    var allRevs = [];
    async function getPit(db, rev, team) {
      return new Promise((resolve, reject) => {
        db.get(`pit_${teamNumber}`, rev, function (err, doc) {
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
                ...doc
              });
            });
        });
      });
    }
    async function getPhotos(db, team) {
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
                attachments
              });
            });
        });
      });
    }
    var revs = "";
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://127.0.0.1:5984/' + dbname + "/pit_" + teamNumber + "?revs_info=true", false, "username", "password");
    xhr.onload = function () {
      revs = JSON.parse(xhr.responseText);
    };
    xhr.send();
    for (var i = 0, length = revs._revs_info.length; i < length; i++) {
      allRevs.push(await getPit(db, revs._revs_info[i].rev, teamNumber));
    }
    return {
      data: allRevs,
      attachments: await getPhotos(db, teamNumber)
    }
  },
  getTeamAverage: async (dbname, eventKey, teams) => {
    const db = new (cradle.Connection)('http://127.0.0.1', 5984, {
      auth: { username: 'username', password: 'password' }
    }).database(dbname);
    var allTeamAverages = [];
    for (var a = 0, length = teams.teams.length; a < length; a++) {
      var team = teams.teams[a].substring(3, 7);
      var teamevent = await TeamEvent.get(team, eventKey, "abc");
      const matches = await Promise.all(
        teamevent.matches
          .map(match => match.match(/qm(\d+)/))
          .filter(match => !!match)
          .map(match => match[1])
          .filter(match => !!match)
          .map((match) => {
            return new Promise((resolve, reject) => {
              db.get(`q${match}_${team}`, function (err, doc) {
                if (err) { resolve(null); } else { resolve(doc); }
              });
            });
          }));
      const teamMatches = matches.filter(m => !!m);
      function sum(key) {
        var sum = 0;
        for (var i = 0, length = teamMatches.length; i < length; i++) {
          sum = sum + teamMatches[i][key];
        }
        return sum;
      }
      function mode(key) {
        var modeArray = [];
        for (var i = 0, length = teamMatches.length; i < length; i++) {
          modeArray.push(teamMatches[i][key]);
        }
        let mf = 1;
        let m = 0;
        let item;
        for (let i = 0; i < modeArray.length; i++) {
          for (let j = i; j < modeArray.length; j++) {
            if (modeArray[i] == modeArray[j])
              m++;
            if (mf < m) {
              mf = m;
              item = modeArray[i];
            }
          }
          m = 0;
        }
        var result = `${item}`;
        return result;
      }
      const teamAverages = {
        "_id": team,
        "scoutName": mode("scoutName"),
        "startingPosition": mode("startingPosition"),
        "autoCrossedBaseline": sum("autoCrossedBaseline") / teamMatches.length * 100,
        "autoSwitchCube": sum("autoSwitchCube") / teamMatches.length * 100,
        "autoScaleCube": sum("autoScaleCube") / teamMatches.length * 100,
        "teleopScaleCubes": sum("teleopScaleCubes") / teamMatches.length,
        "teleopSwitchCubes": sum("teleopSwitchCubes") / teamMatches.length,
        "teleopOpponentSwitchCubes": sum("teleopOpponentSwitchCubes") / teamMatches.length,
        "teleopExchangeCubes": sum("teleopExchangeCubes") / teamMatches.length,
        "teleopDroppedCubes": sum("teleopDroppedCubes") / teamMatches.length,
        "successPercent": sum("successPercent") / teamMatches.length,
        "climbingType": mode("climbingType"),
        "speedRating": sum("speedRating") / teamMatches.length,
        "stabilityRating": sum("stabilityRating") / teamMatches.length,
        "skillRating": sum("skillRating") / teamMatches.length,
        "defenceRating": sum("defenceRating") / teamMatches.length,
        "anythingBreak": sum("anythingBreak") / teamMatches.length * 100,
        "robotDead": sum("robotDead") / teamMatches.length * 100,
      }
      allTeamAverages.push(teamAverages);;
    }
    return allTeamAverages;
  },
  getAllTeamPit: async (dbname, teams) => {
    const db = new (cradle.Connection)('http://127.0.0.1', 5984, {
      auth: { username: 'username', password: 'password' }
    }).database(dbname);
    var allTeamPit = [];
    async function getPit(team) {
      return new Promise((resolve, reject) => {
        db.get('pit_' + team, function (err, doc) {
          if (err) { reject(err); return; }

          Promise.all(Object.keys(doc._attachments).map(att => {
            return new Promise((r, j) => {
              db.getAttachment('pit_' + team, att, function (err, reply) {
                r(reply.body.toString('base64'));
              });
            });
          }))
            .then(attachments => {
              delete doc._attachments;
              resolve({
                ...doc
              });
            });
        });
      });
    }
    for (var i = 0, length = teams.teams.length; i < length; i++) {
      var team = teams.teams[i].substring(3, 7);
      allTeamPit.push(await getPit(team));
    }
    return allTeamPit;
  },
};
