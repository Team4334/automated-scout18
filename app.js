const Koa = require('koa');
const Router = require('koa-router');
const pug = require('pug');

const app = new Koa();
const router = new Router();

const Team = require('./models/team');

const addView = (path, view, getModel) => {
  router.get(path, async (ctx) => {
    ctx.body = pug.renderFile(`./views/${view}.pug`, await getModel(ctx));
  });
};

addView('/', 'index', async ctx => {
  const obj = await Team.Year.get(4334, 2016);

  delete obj._;
  console.dir(obj);

  return obj;
});

app.use(router.routes()).use(router.allowedMethods());
app.listen(process.env.PORT || 4334);
