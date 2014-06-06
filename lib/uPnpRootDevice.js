var uPnpDevice = require('./uPnpDevice');

function uPnpRootDevice(uuid, advertisment){
	uPnpDevice.apply(this, arguments);

	//TOOD
}

// inherit from (regular) device
uPnpRootDevice.prototype = Object.create(uPnpDevice.prototype);

module.exports = uPnpRootDevice;