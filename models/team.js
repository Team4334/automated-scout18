const tba = require('./tba');
const lodash = require('lodash');

class Team {
  static async get(number) {
    if (!number) throw new Error('no team number');

    return new Team({
      team: await tba.get(`/team/frc${number}`),
    });
  }

  constructor(obj) {
    this._ = obj;
    this.name = obj.team.nickname;
    this.number = obj.team.team_number;
    this.website = obj.team.website;
    this.key = obj.team.key;
  }
}

class TeamYear extends Team {
  static async get(number, year = 2018) {
    return new TeamYear(await Team.get(number), {
      events: await tba.get(`/team/frc${number}/events/${year}`),
    });
  }

  constructor(team, obj) {
    super(team._);
    this._ = lodash.merge(this._, obj);
    this.events = obj.events.map(event => ({
      name: event.name,
    }));
  }
}

Team.Year = TeamYear;

module.exports = Team;
