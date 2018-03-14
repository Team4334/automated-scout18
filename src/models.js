const tba = require('./tba');
const NodeCache = require('node-cache');
const { calcOPR, calcDPR, calcCCWM } = require('./opr');
const cache = new NodeCache({ stdTTL: 125 });

const componentOPRs = [
  'autoOwnershipPoints',
  'autoPoints',
  'autoRunPoints',
  'autoScaleOwnershipSec',
  'autoSwitchOwnershipSec',
  'endgamePoints',
  'foulCount',
  'foulPoints',
  'rp',
  'techFoulCount',
  'teleopOwnershipPoints',
  'teleopPoints',
  'teleopScaleBoostSec',
  'teleopScaleForceSec',
  'teleopScaleOwnershipSec',
  'teleopSwitchBoostSec',
  'teleopSwitchForceSec',
  'teleopSwitchOwnershipSec',
  'totalPoints',
  'vaultBoostPlayed',
  'vaultBoostTotal',
  'vaultForcePlayed',
  'vaultForceTotal',
  'vaultLevitatePlayed',
  'vaultLevitateTotal',
  'vaultPoints',
];

const wrapAsCacheable = (fn, toKey) => (...args) => {
  const refresh = args[args.length - 1] === true || args[args.length - 1] === 'true';
  const key = toKey(...args);
  const cached = cache.get(key);

  if (!cached || refresh) {
    const value = fn(...args);
    cache.set(key, value);
    return value;
  } else {
    return cached;
  }
};

class Team {
  static async fetch(number) {
    if (!number) throw new Error('no team number');

    return new Team({
      team: await tba.get(`/team/frc${number}`),
    });
  }

  constructor(obj) {
    this.name = obj.team.nickname;
    this.number = obj.team.team_number;
    this.website = obj.team.website;
    this.key = obj.team.key;
  }
}

class Match {
  constructor(match) {
    if (!match.score_breakdown) {
      match.score_breakdown = {};
    }

    this.key = match.key;
    this.number = match.match_number;
    this.hasOccured = !!match.score_breakdown.blue;
    this.teams = {
      red: match.alliances.red.team_keys,
      blue: match.alliances.blue.team_keys,
    };
    const winner = (match.alliances.blue.score > match.alliances.red.score) ? 'blue' : ((match.alliances.red.score > match.alliances.blue.score) ? 'red' : (match.alliances.red.score === match.alliances.blue.score ? 'tie' : null));
    this.result = {
      winner,
      loser: winner === 'red' ? 'blue' : (winner === 'blue' ? 'red' : null),
      blue: {
        score: match.alliances.blue.score,
        breakdown: match.score_breakdown.blue,
      },
      red: {
        score: match.alliances.red.score,
        breakdown: match.score_breakdown.red,
      },
    };
  }
}

class Matches {
  static async fetch(eventKey) {
    if (!eventKey) throw new Error('no key/code');

    return new Matches(await tba.get(`/event/${eventKey}/matches`));
  }

  constructor(list) {
    this.list = list.filter(match => match.comp_level === 'qm').map(match => new Match(match)).sort((a, b) => a.number - b.number);
  }
}

class Stats {
  constructor(matches) {
    matches = matches.filter(match => match.hasOccured);
    const teams = matches
      .reduce((acc, match) => {
        // filter for teams who have played matches
        return acc.concat(match.teams.red).concat(match.teams.blue);
      }, [])
      .filter((item, pos, arr) => {
        // fitler unique
        return arr.indexOf(item) == pos;
      });

    this.opr = {};
    this.dpr = {};
    this.ccwm = {};

    componentOPRs.forEach(component => {
      this.opr[component] = calcOPR(teams, matches, (x) => x[component]);
      this.dpr[component] = calcDPR(teams, matches, (x) => -x[component]); // inversed for prediction
      this.ccwm[component] = calcCCWM(teams, matches, (x) => x[component]);
    });

    this.ranks = {
      opr: {},
      dpr: {},
      ccwm: {},
    };

    ['opr', 'dpr', 'ccwm'].forEach(type => {
      componentOPRs.forEach(component => {
        this.ranks[type][component] =
          Object.keys(this[type][component]).sort((a, b) => Number.parseFloat(this[type][component][b]) - Number.parseFloat(this[type][component][a]));
      });
    });

    const accuracyOfMethod = (accessor) => {
      return 100 * matches.filter((match) => {
        const red = accessor(match.teams.red[0]) + accessor(match.teams.red[1]) + accessor(match.teams.red[2]);
        const blue = accessor(match.teams.blue[0]) + accessor(match.teams.blue[1]) + accessor(match.teams.blue[2]);

        if (red > blue) {
          return match.result.winner === 'red';
        } else if (blue > red) {
          return match.result.winner === 'blue';
        } else {
          return true;
        }
      }).length / matches.length;
    };

    const accuracies = [];
    const types = { opr: this.opr, dpr: this.dpr, ccwm: this.ccwm };
    Object.keys(types).forEach((category) => {
      for (let component in types[category]) {
        // of course rp means you won
        if (component === 'rp') {
          continue;
        }

        accuracies.push({
          type: `${category}-${component}`,
          accuracy: accuracyOfMethod((team) => types[category][component][team]),
        });
      }
    });

    accuracies.sort((a, b) => b.accuracy - a.accuracy);
    this.bests = accuracies;
  }
}

class Event {
  static async fetch(key) {
    if (!key) throw new Error('no event key');

    return new Event({
      info: await tba.get(`/event/${key}`),
      teams: await tba.get(`/event/${key}/teams`),
      matches: await Matches.get(key),
    });
  }

  constructor(obj) {
    this.name = obj.info.name;
    this.key = obj.info.key;
    this.year = obj.info.year;
    this.teams = obj.teams.map(team => team.key);
    this.stats = new Stats(obj.matches.list);

    const [ bestType, bestComponent ] = this.stats.bests[0].type.split('-');

    this.matches = obj.matches.list.map((match) => {
      const red = match.teams.red.reduce((acc, team) => acc + this.stats[bestType][bestComponent][team], 0);
      const blue = match.teams.blue.reduce((acc, team) => acc + this.stats[bestType][bestComponent][team], 0);
      return {
        ...match,
        prediction: {
          type: bestType,
          component: bestComponent,
          winner: red > blue ? 'red' : 'blue',
          red, blue,
        },
      };
    });

    this.prediction = { teams: {} };
    this.teams.forEach(team => this.prediction.teams[team] = {
      wins: 0,
      ties: 0,
      loses: 0,
    });

    this.matches.forEach((match) => {
      if (match.hasOccured) {
        if (match.result.winner === 'tie') {
          match.teams.red.forEach(team => this.prediction.teams[team].ties += 1);
          match.teams.blue.forEach(team => this.prediction.teams[team].ties += 1);
        } else {
          match.teams[match.result.winner].forEach(team => this.prediction.teams[team].wins += 1);
          match.teams[match.result.loser].forEach(team => this.prediction.teams[team].loses += 1);
        }
      } else {
        match.teams[match.prediction.winner].forEach(team => this.prediction.teams[team].wins += 1);
        match.teams[match.prediction.loser].forEach(team => this.prediction.teams[team].loses += 1);
      }
    });

    this.prediction.ranking = {
      record: Object.keys(this.prediction.teams).sort((a, b) => {
        const predA = this.prediction.teams[a];
        const predB = this.prediction.teams[b];
        return (predB.wins * 2 + predB.ties) - (predA.wins * 2 + predA.ties);
      }),
    };
  }
}

class TeamEvent {
  static async fetch(number, key, refresh) {
    return new TeamEvent(await Team.get(number, refresh), await Event.get(key, refresh));
  }

  constructor(team, event) {
    this.team = team;
    this.event = event;
    this.matches = event.matches.filter((match) => {
      return match.teams.red.indexOf(team.key) !== -1 || match.teams.blue.indexOf(team.key) !== -1;
    }).map(match => match.key);
    this.stats = {};
    Object.keys(event.stats).forEach(type => {
      if (type === 'bests') { return; }
      if (type === 'ranks') { return; }
      this.stats[type] = { };
      Object.keys(event.stats[type]).forEach(key => {
        this.stats[type][key] = {
          value: event.stats[type][key][team.key],
          rank: event.stats.ranks[type][key].indexOf(team.key) + 1,
        };
      });
    });
  }
}

class TeamYear {
  static async fetch(number, year = 2018, refresh) {
    return new TeamYear(
      await Team.get(number, refresh),
      await Promise.all((await tba.get(`/team/frc${number}/events/${year}`))
        .map(event => TeamEvent.get(number, event.key, refresh))),
    );
  }

  constructor(team, events) {
    this.team = team;
    this.events = events;
  }
}

Team.get = wrapAsCacheable(Team.fetch, (number) => `Team:${number}`);
Matches.get = wrapAsCacheable(Matches.fetch, (eventKey) => `Matches:${eventKey}`);
Event.get = wrapAsCacheable(Event.fetch, (key) => `Event:${key}`);
TeamEvent.get = wrapAsCacheable(TeamEvent.fetch, (key) => `TeamEvent:${key}`);
TeamYear.get = wrapAsCacheable(TeamYear.fetch, (key) => `TeamYear:${key}`);

module.exports = {
  Team,
  Matches,
  Event,
  TeamEvent,
  TeamYear,
};
