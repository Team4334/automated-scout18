const tba = require('./tba');

class Team {
  static async get(number) {
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
  static async get(key) {
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
  static async get(number, key) {
    return new TeamEvent(await Team.get(number), await Event.get(key));
  }

  constructor(team, event) {
    this.team = team;
    this.event = event;
  }
}

class TeamYear {
  static async get(number, year = 2018) {
    return new TeamYear(
      await Team.get(number),
      await Promise.all((await tba.get(`/team/frc${number}/events/${year}`))
        .map(event => TeamEvent.get(number, event.key))),
    );
  }

  constructor(team, events) {
    this.team = team;
    this.events = events;
  }
}

module.exports = {
  Team,
  TeamEvent,
  TeamYear,
};
