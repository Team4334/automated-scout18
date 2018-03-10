const numeric = require('numeric');

const calc = (teams, matches, toScore, getResult) => {
  const played = new Array(teams.length);
  for (let i = 0; i < teams.length; i++) {
    played[i] = new Array(teams.length);
    for (let x = 0; x < teams.length; x++) {
      played[i][x] = 0; // 2d matrix
    }
  }

  matches.forEach(function(match) {
    const red = match.teams.red,
      blue = match.teams.blue;
    for (let x = 0; x < red.length; x++) {
      for (let y = 0; y < red.length; y++) {
        played[teams.indexOf(red[x])][teams.indexOf(red[y])]++;
      }
    }
    for (let x = 0; x < blue.length; x++) {
      for (let y = 0; y < blue.length; y++) {
        played[teams.indexOf(blue[x])][teams.indexOf(blue[y])]++;
      }
    }
  });

  const points = teams.map(function(team) {
    return matches.reduce(function(sum, match) {
      if (match.teams.red.indexOf(team) !== -1) {
        return sum + toScore(getResult(match.result, 'red').breakdown);
      } else if (match.teams.blue.indexOf(team) !== -1) {
        return sum + toScore(getResult(match.result, 'blue').breakdown);
      } else {
        return sum;
      }
    }, 0);
  });

  const solution = numeric.solve(played, points);

  const oprs = {};
  teams.forEach(function(team, i) {
    oprs[team] = solution[i];
  });

  return oprs;
};

const calcOPR = (teams, matches, toScore) => calc(teams, matches, toScore, (result, color) => result[color]);
const calcDPR = (teams, matches, toScore) => calc(teams, matches, toScore, (result, color) => result[color === 'red' ? 'blue' : 'red']);

const calcCCWM = (teams, matches, toScore) => {
  const oprs = calcOPR(teams, matches, toScore);
  const dprs = calcDPR(teams, matches, toScore);
  const result = {};
  Object.keys(oprs).forEach((key) => {
    result[key] = oprs[key] - dprs[key];
  });
  return result;
};

module.exports = {
  calcOPR,
  calcDPR,
  calcCCWM,
};
