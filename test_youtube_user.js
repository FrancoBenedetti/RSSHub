const { getDataByUsername } = require('./lib/routes/youtube/api/youtubei');

async function run() {
    try {
        const res = await getDataByUsername({
            username: '@BizNewsTV',
            embed: false,
            filterShorts: true,
            isJsonFeed: false
        });
        console.log(res.title);
        console.log('Items count:', res.item.length);
    } catch (e) {
        console.error('Error:', e);
    }
}
run();
