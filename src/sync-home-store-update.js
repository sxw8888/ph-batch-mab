const dotenv = require('dotenv');
dotenv.config();
const events = require('events');
const logger = require('./config/logger.js');
const mergeData = require('./services/mergeData.js');
const os = require('os-utils');

var em = new events.EventEmitter(); 

async function init() {
 
    logger.log('info', `(home-store-update) # Started`);
    const customerRecoveryStatus = await mergeData.mergeCustomerRecovery();
    logger.log('info', `(home-store-update) # Ended! ${JSON.stringify(customerRecoveryStatus)}`);
    em.emit('event');
    return true;
}

function start() {
    
    init();
    
    var myInterval = setInterval(function() {
	var memTotal = (process.memoryUsage().heapTotal / (1024 * 1024)).toFixed(3);
	var memUsed = (process.memoryUsage().heapUsed / (1024 * 1024)).toFixed(3);
        var memUsedPercent = (memUsed / memTotal * 100).toFixed(3);
        var memAvailablePercent = 100 - memUsedPercent;  
	logger.log('info', `(Main: Memory logging) Used/Total: ${memUsed}/${memTotal} (MB) -- Memory used percentage: ${memUsedPercent} % `);
    }, 1000);
    
    em.on('event', () => {
  	logger.log('info', `####### Process Ended at ${new Date(Date.now()).toLocaleString()} ########`)
        clearInterval(myInterval);
    });

}

start();	
