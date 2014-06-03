var uPnpDevice = require('./uPnpDevice').uPnpDevice;

function uPnpRootDevice(uuid){
	this.uuid = uuid;
	//TODO
}

// inherit from (regular) device
//uPnpRootDevice.prototype = Object.create(uPnpDevice.prototype);
uPnpRootDevice.prototype = Object.create(uPnpDevice);

exports.uPnpRootDevice = uPnpRootDevice;