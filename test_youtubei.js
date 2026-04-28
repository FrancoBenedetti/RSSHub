import { getDataByUsername } from './lib/routes/youtube/api/youtubei.js';

async function test() {
  try {
    const data = await getDataByUsername({ username: '@BizNewsTV', embed: false, filterShorts: true, isJsonFeed: false });
    console.log(data.title);
    console.log('Items length:', data.item.length);
    if(data.item.length > 0) {
      console.log('First item title:', data.item[0].title);
    }
  } catch(e) {
    console.error(e);
  }
}
test();
