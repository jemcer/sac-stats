const axios = require('axios');
const fs = require('fs');

const bearer = fs.readFileSync('bearer.txt', 'utf8').replace(/(\r\n|\r|\n)/g, '');
const base_url = 'https://www.epicgames.com/affiliate/api/v2';

async function request(url) {
  return await axios
    .get(url, { headers: { cookie: 'EPIC_BEARER_TOKEN=' + bearer } })
    .then(response => response.data)
    .catch(error => console.log(error.response?.data || error));
}

Date.prototype.format = function (short) {
  let date = short ? '' : '-' + this.getDate();
  return `${this.getFullYear()}-${this.getMonth() + 1}${date}`;
};

Array.prototype.sum = function () {
  return this.length ? this.reduce((acc, curr) => acc + curr) : 0;
};

Number.prototype.fix = function () {
  return parseFloat(this.toFixed(2));
};

async function main() {
  let profile = await request(`${base_url}/get-affiliate-profile`);

  let date = new Date(profile.data.statusEffectiveDate);
  let one_month = 31 * 24 * 60 * 60 * 1000;

  let output = { earnings: {}, supporters: {}, data: {} };

  while (date < Date.now() + one_month) {
    console.log('GET data', date.format(true));

    let month = await request(`${base_url}/get-dashboard-data?date=${date.format()}`);
    let games = Object.values(month.data.earnedProducts);

    output.earnings[date.format(true)] = games
      .map(game => game.totalEstimatedEarnings || 0)
      .sum()
      .fix();

    output.supporters[date.format(true)] = games.map(game => game.totalUniqueSupporters || 0).sum();

    let data = Array().concat(...games.map(game => game.data));
    let dates = [...new Set(data.map(entry => entry.date))];

    data = Object.fromEntries(
      dates.map(_date => [
        _date,
        data
          .filter(entry => entry.date === _date)
          .map(entry => entry.referrals || 0)
          .sum(),
      ])
    );

    Object.assign(output.data, data);

    date = new Date(date.getTime() + one_month);
  }

  output.sum = {
    earnings_est: (await request(`${base_url}/get-earnings-data`)).data.eligibleEarnings,
    earnings_sum: Object.values(output.earnings).sum().fix(),
    supporters: Object.values(output.supporters).sum(),
  };

  await fs.promises.writeFile('output.json', JSON.stringify(output, null, 2));

  delete output.data;
  console.log(JSON.stringify(output, null, 2));

  console.log('use code jem #ad');
}

main();
