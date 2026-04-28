import { config } from 'dotenv';
config();
import { getDataByUsername } from './lib/routes/youtube/api/google.js';

async function test() {
  try {
    const data = await getDataByUsername({ username: '@BizNewsTV', embed: false, filterShorts: true, isJsonFeed: false });
    console.log(data);
  } catch(e) {
    console.error(e);
  }
}
test();
