const fs = require('fs');
const path = require('path');
const spider = require('salticidae').spider;

const targetUrl = process.argv.find(arg => /^http:/.test(arg));

const outputFilePath = path.resolve(__dirname, '../player-data.json');

if (!targetUrl) {
  console.error('No URL provided, cannot proceed!');
  console.log();
  console.log('Usage:');
  console.log(' node download-player-stats.js http://path-to.url/to/scrape/for/data');
  console.log();
  process.exit(0);
}

// Helpers
const cleanText = node => node.text().replace(/\n/g, '').trim();

const throwOrResolve = (resolve, reject, err, result) => (err ? reject(err) : resolve(result));

const writeJSON = (file, contents) => new Promise((resolve, reject) => {
  const json = JSON.stringify(contents);
  fs.writeFile(file, json, err => throwOrResolve(resolve, reject, err, json));
});

// Make the request & parse the results into a data array
spider(targetUrl, {
  playerStats: ($) => {
    const players = [];
    $('p table').each((idx, tableEl) => {
      const $table = $(tableEl);
      const player = {
        name: '',
        keyTechniques: [],
        location: '',
        stats: [],
        region: '',
      };
      const $rows = $table.find('tr');
      player.name = cleanText($rows.first());
      player.keyTechniques = cleanText($rows.eq(1))
        .replace(/Key\s+Techniques:\s*/i, '')
        .split(',')
        .map(technique => technique.trim());
      player.location = cleanText($rows.eq(2))
        .replace(/Location:\s*/i, '');
      player.region = player.location.split(' ').shift();

      // Build the stats array
      const stats = [];
      $rows.eq(2).nextAll().each((rowIdx, trEl) => {
        const row = [];
        $(trEl).find('td').each((tdIdx, tdEl) => {
          row.push(cleanText($(tdEl)));
        });
        stats.push(row);
      });

      if (!stats.length) {
        // Not a player object!
        return;
      }

      // stats is an array that now looks like this:
      // [
      //   [ 'LV',   1,   5,  10,  15, ... ],
      //   [ 'HP', '-', 215, 400, 625, ... ],
      //   [ 'SP', '-',  65,  65,  66, ... ],
      //   [ 'EN', '-',  10,  13,  16, ... ],
      //   [ 'AT', '-',   6,   7,   8, ... ],
      //   [ 'PA', '-',  14,  18,  22, ... ],
      //   [ 'BL', '-',   6,   9,  11, ... ],
      //   [ 'SH', '-',   5,   7,   8, ... ],
      //   [ 'CA', '-',   1,   1,   2, ... ],
      // ]

      // Skip the "LV" column, only process registered numeric levels
      // eslint-disable-next-line arrow-body-style
      const levels = stats[0].slice(1).map((level, col) => {
        // Go through each row of stats and register this level
        return stats.slice(1).reduce((levelObj, statRow) => {
          // col + 1 to make up for the .slice(1) on parent stats array;
          // cast values to numbers as we go
          const val = +statRow[col + 1];
          return Object.assign({}, levelObj, {
            [statRow[0].toLowerCase()]: isNaN(val) ? null : val,
          });
        }, {
          level: +level,
        });
      });
      player.stats = levels;

      players.push(player);
    });
    return players;
  },
})
  // Write the output
  .then(results => writeJSON(outputFilePath, results.playerStats))
  // Catch errors
  .catch(e => console.error(e));
