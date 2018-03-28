const Koa = require('koa');
const Router = require('koa-router');
const pug = require('pug');
const tba = require('./tba');
const scouting = require('./scouty-mcscout');
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest;

const router = new Router();

const {
  Team,
  Matches,
  Event,
  TeamEvent,
  TeamYear,
} = require('./models');

// API
router.get('/team/:number', async (ctx) => {
  ctx.body = await Team.get(ctx.params.number, ctx.query.refresh);
});

router.get('/event/:key/matches', async (ctx) => {
  ctx.body = await Matches.get(ctx.params.key, ctx.query.refresh);
});

router.get('/team/:number/:year', async (ctx) => {
  ctx.body = await TeamYear.get(ctx.params.number, ctx.params.year, ctx.query.refresh);
});

// Views
const addView = (path, view, getModel) => {
  router.get(path, async (ctx) => {
    const model = await getModel(ctx);
    if (ctx.query.json == 'true') {
      ctx.body = model; return;
    } else {
      ctx.body = pug.renderFile(`./views/${view}.pug`, model);
    }
  });
};

addView('/', 'index', async (ctx) => {
  const events = await tba.get('/events/2018/simple');

  events.sort(function (a, b) {
    let s = Date.parse(a.start_date) - Date.parse(b.start_date);
    if (s == 0) {
      s = a.key.localeCompare(b.key);
    }
    return s;
  });


  const event_info = { now: [], future: [], past: [] };

  events.forEach((event) => {
    const from = Date.parse(event.start_date);
    const to = new Date(Date.parse(event.end_date));
    to.setDate(to.getDate() + 1);
    if (Date.now() > from) {
      if (Date.now() <= to) {
        event_info.now.push(event);
      } else {
        event_info.past.push(event);
      }
    } else {
      event_info.future.push(event);
    }
  });

  return { event_info };
});

addView('/event/:key', 'event', async (ctx) => {
  return { event: await Event.get(ctx.params.key, ctx.query.refresh) };
});

addView('/team/:number/event/:key', 'teamevent', async (ctx) => {
  const teamevent = await TeamEvent.get(ctx.params.number, ctx.params.key, ctx.query.refresh);
  const dbname = ctx.params.key.substring(4, 8) + ctx.params.key.substring(0, 4);
  var exists = "";

  var xhr = new XMLHttpRequest();
  xhr.open('HEAD', 'http://127.0.0.1:5984/' + dbname, false, "username", "password");
  xhr.onload = function() {
      if (xhr.status === 200) {
        exists = true;
      } else if (xhr.status == 404) {
        console.log("Database not found. " + dbname)
        exists = false;
      } else if (xhr.status == 401) {
        console.log("Incorrect username or password.");
        exists = false;
      } else {
        console.log("Database responded with:" + xhr.status);
        exists = false;
      }
  };
  xhr.send();
  
  if (exists == true) {
    return {
      teamevent,
      scouting: {
        pit: await scouting.getTeamPit(dbname, ctx.params.number),
        matches: await scouting.getTeamMatches(dbname, ctx.params.number, teamevent),
      },
    };
  } else {
    return {
      teamevent,
      scouting: {
      },
    };
  }
});

new Koa()
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(process.env.PORT || 4334);

console.log(`Server on localhost:${process.env.PORT || 4334}`);
