const app = require('./app');
const config = require('./config');
const { startPurgeSchedule } = require('./services/purge');

startPurgeSchedule();

app.listen(config.port, () => {
  console.log(`MSB Stuff running at http://localhost:${config.port}`);
});
