const tba = require('./tba');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 125 });

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

class Event {
  static async fetch(key) {
    if (!key) throw new Error('no event key');

    return new Event({
      info: await tba.get(`/event/${key}`),
    });
  }

  constructor(obj) {
    this.name = obj.info.name;
    this.key = obj.info.key;
  }
}

class TeamEvent {
  static async fetch(number, key, refresh) {
    return new TeamEvent(await Team.get(number, refresh), await Event.get(key, refresh));
  }

  constructor(team, event) {
    this.team = team;
    this.event = event;
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
Event.get = wrapAsCacheable(Event.fetch, (key) => `Event:${key}`);
TeamEvent.get = wrapAsCacheable(TeamEvent.fetch, (key) => `TeamEvent:${key}`);
TeamYear.get = wrapAsCacheable(TeamYear.fetch, (key) => `TeamYear:${key}`);

module.exports = {
  Team,
  TeamEvent,
  TeamYear,
};
