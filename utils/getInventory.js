const rustMarketItems = require('../rust_market_items.json');
const axios = require('axios');

const getInventory = async (appid, steamid, contextid = 2, tradeable = false) => {
  if (typeof appid !== 'number') appid = 730;
  if (typeof contextid === 'string') contextid = parseInt(contextid, 10);
  if (typeof tradeable !== 'boolean') tradeable = false;
  if (!steamid) {
    throw new Error('SteamID is required');
  }

  try {
    const response = await axios.get(`https://steamcommunity.com/inventory/${steamid}/${appid}/${contextid}`);
    const body = response.data;

    let items = body.descriptions;
    let assets = body.assets;
    let marketnames = [];
    let assetids = [];
    let prices = [];

    // Create a map to group assets by their market_hash_name
    let groupedItems = {};

    for (let asset of assets) {
      let description = items.find(item => item.classid === asset.classid && item.instanceid === asset.instanceid);
      if (description) {
        let market_hash_name = description.market_hash_name;

        if (!groupedItems[market_hash_name]) {
          groupedItems[market_hash_name] = {
            market_hash_name: market_hash_name,
            icon_url: `https://steamcommunity-a.akamaihd.net/economy/image/${description.icon_url}`,
            price: 0,
            quantity: 0,
            assetIds: [],
          };

          // Find the corresponding price for the item from rust_market_items.json
          const marketItem = rustMarketItems.find(marketItem => marketItem.name === market_hash_name);
          groupedItems[market_hash_name].price = marketItem ? marketItem.price : 'Price not found';
        }

        groupedItems[market_hash_name].quantity += 1;
        groupedItems[market_hash_name].assetIds.push(asset.assetid);
      }
    }

    let data = {
      raw: body,
      items: Object.values(groupedItems),
      marketnames: Object.keys(groupedItems),
      assets: assets.map(asset => asset.assetid),
      assetids: Object.values(groupedItems).flatMap(item => item.assetIds),
    };

    if (tradeable) {
      data.items = data.items.filter(x => x.tradable === 1);
    }
    // console.log(data);
    
    return data;
  } catch (error) {
    console.error('Inventory Error:', error.response ? error.response.data : error.message);
    throw error;
  }
};

module.exports = {
  getInventory
};
