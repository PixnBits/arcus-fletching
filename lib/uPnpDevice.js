//var EventEmitter = require('events').EventEmitter;

function uPnpDevice(uuid){
	this.uuid = uuid;
	//TODO
}

uPnpDevice.prototype.validTo = function(thenSeconds){
	// if thenSeconds is less than a year, interpret as the number of seconds to live from now
	if(thenSeconds < 60*60*24*7*52){
		thenSeconds += Date.now();
	}

	this.expires = thenSeconds;
}

exports.uPnpDevice = uPnpDevice;