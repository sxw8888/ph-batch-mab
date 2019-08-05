/* eslint-disable no-await-in-loop */
// eslint-disable-next-line no-unused-vars
const config = require('../config/config.js');
const logger = require('../config/logger.js');
const options = require('../config/databaseConfig.js');
const snowflakeC360 = require('../repositories/snowflakeC360.js');
const brazeHomeStoreUpdate = require('../repositories/braze-home-store-update.js');

const iBatchSize = parseInt(process.env.BATCH_SIZE, 10);
let totalBatches_HOME_STORE_UPDATES = 1;

const fetchCounts = async (processDate, snowConnection) => {
  logger.log('info', `(Service/mergeData.fetchCounts) # fetching counts...`);
  const rows = await snowflakeC360.getCounts(processDate, snowConnection).catch(error => {
    logger.log('error', `(Service/mergeData.fetchCounts) # Unable to execute query on SNOWFLAKE DB : ${JSON.stringify(error)}`);
    return Promise.reject(error);
  });

  if (rows && rows.length > 0) {
    rows.forEach(doc => {
      logger.log('info', `(Service/mergeData.fetchCounts) # counts...${doc.CATEGORY}, ${doc.TOTALCOUNTS}`);
      if (doc.CATEGORY === 'MAB_DEMO') { totalBatches_HOME_STORE_UPDATES = Math.ceil(doc.TOTALCOUNTS / iBatchSize); }
    });
  }
  return Promise.resolve(rows);
};

const fetchAndUpdateHomeStore = async (processDate, snowConnection) => {
  const statusFetchAndUpdateHomeStore = [];
  // eslint-disable-next-line no-plusplus
  for (let iBatch = 0; iBatch < totalBatches_HOME_STORE_UPDATES; iBatch++) { //totalBatches_HOME_STORE_UPDATES
    let batchUpdateHomeStoreUpdates = [];
    const transactionOperations = [];
    let customerHomeStoreUpdate = {};

    logger.info(`(Service/mergeData.fetchAndUpdateHomeStore) # Starting from batch ${iBatch} / ${totalBatches_HOME_STORE_UPDATES}`);
    const capturedHomeStoreUpdates = await snowflakeC360.fetchHomeStoreUpdates(processDate,
      snowConnection, iBatch * iBatchSize, iBatchSize)
      .catch(error => {
        logger.log('error', `(Service/mergeData.fetchAndUpdateHomeStore) # Unable to execute query on SNOWFLAKE DB : ${JSON.stringify(error)}`);
        return Promise.reject(error);
      });
    batchUpdateHomeStoreUpdates = capturedHomeStoreUpdates.map(row => {
      customerHomeStoreUpdate = {
        external_id: row.EXTERNAL_ID,
	TREATMENT: row.TREATMENT,
	OPT_OUT_FLAG: row.OPT_OUT_FLAG,
	FLASH: row.FLASH,
	OFFER_A: row.OFFER_A,
	OFFER_B: row.OFFER_B,
	OFFER_C: row.OFFER_C,
	OFFER_D: row.OFFER_D,
	OFFER_E: row.OFFER_E,
	OFFER_F: row.OFFER_F,
	OFFER_G: row.OFFER_G
    };
      return customerHomeStoreUpdate;
    });
    transactionOperations.push(brazeHomeStoreUpdate.updateHomeStore(batchUpdateHomeStoreUpdates,
      iBatch));
    const updateHomeStore = await Promise.all(transactionOperations).catch(error => {
      logger.log('error', `(Service/mergeData.fetchAndUpdateHomeStore-updateHomeStore) # Error promiseResponse : ${error} `);
      return Promise.reject(error);
    });
    //logger.info(`(Service/mergeData.fetchAndUpdateHomeStore-updateHomeStore) # effected records Braze ...${updateHomeStore.length}`);
    statusFetchAndUpdateHomeStore.push(updateHomeStore);
  }
  return Promise.resolve(statusFetchAndUpdateHomeStore);
};
const connectAndProcess = async (processDate) => {
  const snowConnection = await snowflakeC360.snowflakeDBConnection(options.snowflakeDBOption)
    .catch(error => {
      logger.log('error', `(home-store-update) # Captured SNOWFLAKE DB Connection error from Data layer Aborting.. ${JSON.stringify(error)}`);
      return Promise.reject(error);
    });

  logger.log('info', `(Service/mergeData.connectAndProcess) # Data layer indicated SUCCESSFUL SNOWFLAKE Connection # ${snowConnection}`);
  // const mongoConnection = await mongoCustomerRecovery.mongoDBConnection(process.env.DBURL
  // , options.mongoDBOptions)
  //   .catch(error => {
  //     logger.log('error', `(Service/mergeData.connectAndProcess) #
  // Captured MongoDB Connection error from Data layer Aborting.. ${JSON.stringify(error)}`);
  //     return Promise.reject(error);
  //   });
  // logger.log('info', `(Service/mergeData.connectAndProcess) #
  // Data layer indicated SUCCESSFUL MONGO Connection # ${mongoConnection}`);
  logger.log('info', `(Service/mergeData.connectAndProcess) # Starting process for # ${processDate}`);

  await fetchCounts(processDate, snowConnection);
  await fetchAndUpdateHomeStore(processDate, snowConnection);

  // mongoConnection.disconnect();
  return {
    message: 'successfully finished!'
  };
};

const mergeCustomerRecovery = () => {
  const tempDate = new Date(process.env.TARGET_DATE);
  const processDate = new Date(tempDate).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
    // return new Promise( (resolve) => resolve(connectAndProcess(processDate)));
  return connectAndProcess(processDate);
};

module.exports = {
  mergeCustomerRecovery
};
