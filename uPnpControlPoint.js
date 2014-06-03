var dgram = require('dgram');
var EventEmitter = require('events').EventEmitter;

var uPnpRootDevice = require('./lib/uPnpRootDevice').uPnpRootDevice;
var uPnpDevice = require('./lib/uPnpDevice').uPnpDevice;

var UPNP_BROADCAST_IP = '239.255.255.250';
var UPNP_BROADCAST_PORT = 1900;
var UPNP_DISCOVERY_MESSAGE = 
	'M-SEARCH * HTTP/1.1'+'\r\n'+
	'HOST: 239.255.255.250:1900'+'\r\n'+
	'MAN: "ssdp:discover"'+'\r\n'+
	'MX: 10'+'\r\n'+
	'ST: ssdp:all'+'\r\n\r\n';


function identity(v){ return v; }
function proper(str){
	return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
}

function toCamelcase(str){
	if('string' !== typeof str){
		return str;
	}
	parts = str.split('-').filter(identity).map(proper);
	parts[0] = parts[0].toLowerCase();

	return parts.join('');
}


function uPnpControlPoint(){
	if(!(this instanceof uPnpControlPoint)){
		return new uPnpControlPoint();
	}

	EventEmitter.call(this);

	this.rootDevices = {};
	this.devices = {};
	this.services = {};

	this._broadcastSocket = null;

	var self = this;
	this.on('found', function(){ self._pruneExpiredDevices(); })
	this.on('updated', function(){ self._pruneExpiredDevices(); })

	console.log('created new uPnpControlPoint');
}

uPnpControlPoint.prototype = Object.create(EventEmitter.prototype);

uPnpControlPoint.prototype.listen = function(callback){
	var self = this;
	// dgram.createSocket(type, [callback])
	// `type` String. Either 'udp4' or 'udp6'
	var socket = this._broadcastSocket = dgram.createSocket('udp4'/*, function(socket){
		console.log('dgram.createSocket callback', arguments);
	}*/);

	socket.on('listening', function(){
		var address = socket.address();
		console.log('UDP socket listening on ' + address.address + ":" + address.port);
	});

	socket.on('message', function(message, remote){
		console.log('socket got message: ('+ new Date() +')\n' + remote.address + ':' + remote.port +'\n' + message);
		self._analyzeBroadcastMessage(message, remote);
	});

	socket.on('error', function(){
		console.error('socket had error', arguments);
	});

	console.log('created socket');

	socket.bind(UPNP_BROADCAST_PORT, '0.0.0.0', function(){
		console.log('bound socket');
		socket.addMembership(UPNP_BROADCAST_IP);
		console.log('added broadcast membership to socket');

		if(callback){
			callback();
		}
	});
	console.log('binding socket...');
};

uPnpControlPoint.prototype.search = function(opts){ // `opts` could be number of times to broadcast, time between broadcasts, etc
	if(!this._broadcastSocket){
		var self = this;
		console.log('this.search?', !!this.search);
		//this.listen(this.search.bind());
		//this.listen();
		this.listen(function(){
			self.search();
		});
		return;
	}

	var socket = this._broadcastSocket;
	var msg = new Buffer(UPNP_DISCOVERY_MESSAGE);
	var discoverySent = 0;

	socket.setBroadcast(true);
	console.log('can now broadcast');

	function broadcastUpnpDiscoveryMessage(){
		console.log('broadcasting discovery message');
		socket.send(
			msg, 			// msg (Buffer)
			0,				// offset
			msg.length,		// length
			UPNP_BROADCAST_PORT,			// port
			UPNP_BROADCAST_IP,	// address
			function(err, bytes) {			// callback
				discoverySent++;
				if(err){
					console.error('Error sending discovery message: ' + err, err);
				}else{
					console.log('sent discovery message', bytes === msg.length);
				}
			}
		);

		//if( discoverySent < 2){
		if( discoverySent < 0){
			console.log('will broadcast again');
			setTimeout(function(){
				broadcastUpnpDiscoveryMessage();
			}, 35 * 1000);
		}
	}
	broadcastUpnpDiscoveryMessage();
};

function formatBroadcastMessage(message, sender){
	var data = {
		origin: sender,
		method: null,
		headers: {}
	};
	/*
	message: Buffer
	sender: {
		address: string,
		family: 'IPv4' or 'IPv6',
		port: number,
		size: number
	}
	*/
	/*
	NOTIFY * HTTP/1.1
	HOST: 239.255.255.250:1900
	CACHE-CONTROL: max-age=1800
	LOCATION: http://192.168.11.40:52323/dmr.xml
	NT: upnp:rootdevice
	NTS: ssdp:alive
	SERVER: Linux/2.6 UPnP/1.0 Sony-BDP/2.0
	USN: uuid:00000000-0000-1010-8000-3c07715033ee::upnp:rootdevice
	X-AV-Physical-Unit-Info: pa="Blu-ray Disc Player";
	X-AV-Server-Info: av=5.0; cn="Sony Corporation"; mn="Blu-ray Disc Player"; mv="2.0";
	*/
	//TODO better Buffer usage
	var lines = message.toString().split(/\r|\n/g).filter(identity);
	var msgMethod = lines.shift();

	//console.log('lines', lines);

	data.method = /^([^\s]+)/.exec(msgMethod)[1];
	lines.forEach(function(line){
		// header-name: header-value
		var parts = /^\s*(.+?)\s*:\s*(.+)\s*$/.exec(line);
		if(parts){
			var name = toCamelcase(parts[1]);
			var val = parts[2];
			// careful, IP addresses are valid numbers (ex: '239.255.255.250' ==> 239.255)
			var mightBeANumber = parseFloat(val);
			if(!isNaN(mightBeANumber) && mightBeANumber.toString() === val){
				val = mightBeANumber;
			}

			data.headers[name] = val;
		}else{
			console.error('invalid header found:', line);
		}
	});

	//console.log('formatted broadcast message', data);
	return data;
}

uPnpControlPoint.prototype._analyzeBroadcastMessage = function(message, sender){
	var msg = formatBroadcastMessage(message, sender);
	//console.log('_analyzeBroadcastMessage, msg', msg);

	switch(msg.method.toLowerCase()){
		case 'notify':
			// device advertised itself
			if('ssdp:alive' === msg.headers.nts){
				this._addDeviceByAdvertisement(msg);
			/*}else if('ssdp:update' === msg.headers.nts){
				this._updateDeviceByAdvertisement(msg);*/
			}else{
				console.error('unknown how to handle NOTIFY w/NTS header of', msg.headers.nts);
			}
			break;
		default:
			console.warn('unhandled broadcast method', msg.method, msg);
			break;
	}
};

function cacheControl_parseMaxAge(headerVal){
	var parts = /\s*max-age\s*=\s*(\d+)/.exec(headerVal);
	if(parts){
		return parseInt(parts[1]);
	}

	return null;
}

function parseUsn(usn){
	/*
	USN header, possible values:

	uuid:device-UUID::upnp:rootdevice
	uuid:device-UUID
	uuid:device-UUID::urn:schemas-upnp-org:device:deviceType:ver
	uuid:device-UUID::urn:schemas-upnp-org:service:serviceType:ver
	uuid:device-UUID::urn:domain-name:device:deviceType:ver
	uuid:device-UUID::urn:domain-name:service:serviceType:ver
	*/
	var data = {};

	// array of [ uuid, other-parts ]
	var usnParts = usn.split('::');
	data.uuid = usnParts[0].replace(/^\s*uuid\s*:/,'');

	var extraData = usnParts[1];

	if(extraData){
		extraData = extraData.split(':');
		for(var i=0, n=extraData.length; i<n; i++){
			switch(extraData[i].toLowerCase()){
				case 'upnp':
					data.upnp = data.upnp || {};
					data.upnp[extraData[++i]] = true;
					break;
				case 'urn':
					// will be `schemas-upnp-org` or a domain name
					data.urn = extraData[++i];
					break;
				case 'device':
					// two parts: type and version
					data.device = {
						type : extraData[++i],
						version : extraData[++i]
					};
					break;
				case 'service':
					// two parts: type and version
					data.device = {
						type : extraData[++i],
						version : extraData[++i]
					};
					break;
				default:
					console.error('did something wrong parsing usn, on index '+i, extraData);
					break;
			}
		}
	}

	//console.log('built', data, 'from', usn);
	return data;
}

function parseServer(server){
	// example: 'Linux/2.6 UPnP/1.0 Sony-BDP/2.0'
	var parts = /(\S+)\/([\d\.]+)\s+UPnP\/([\d\.]+)\s+(\S+)\/([\d\.]+)/.exec(server);
	if(parts){
		return {
			os : {
				name: parts[1],
				version : parts[2]
			},
			upnp : {
				version : parts[3]
			},
			product : {
				name: parts[4],
				version : parts[5]
			}
		}
	}
}

uPnpControlPoint.prototype._addDeviceByAdvertisement = function(advertisement){
	var nowSeconds = Date.now() / 1000 |0;
	// 4 (interesting) headers req'd:
	// NT (Notification Type)
	// USN (composite identifier, Unique Service Name)
	// LOCATION (URL for more info)
	// CACHE-CONTROL (duration)

	var ntHeader = advertisement.headers.nt;
	var usn = parseUsn(advertisement.headers.usn);
	var locHeader = advertisement.headers.location;
	var secondsValid = cacheControl_parseMaxAge(advertisement.headers.cacheControl) || 1800; // default is 30min
	var server = parseServer(advertisement.headers.server);

	if('ssdp:alive' !== advertisement.headers.nts){
		console.warn('device supplied an invalid NTS header, ignoring', advertisement.headers.nts, usn);
	}
	if('239.255.255.250:1900' !== advertisement.headers.host){
		console.warn('device supplied an invalid HOST header, ignoring', advertisement.headers.host, usn);
	}


	console.log('device', usn.uuid, 'valid from', nowSeconds, 'to', nowSeconds + secondsValid, '\r\n\r\n');

	if(usn.uuid){
		if(!this.rootDevices[usn.uuid]){
			this.rootDevices[usn.uuid] = new uPnpRootDevice(usn.uuid);
			this.emit('found', this.rootDevices[usn.uuid]);
		}else{
			// just update?
			this.emit('updated', this.rootDevices[usn.uuid]);
		}
	}else{
		console.error('unable to find device uuid?!?', usn, advertisement);
	}

	//TODO

};

uPnpControlPoint.prototype._pruneExpiredDevices = function(){
	//TODO
	var nowSeconds = Date.now() / 1000 |0;
	var closestToExpire = Infinity;
	var controlPoint = this;

	Object.keys(controlPoint.rootDevices)
		.map(function(uuid){
			var device = controlPoint.rootDevices[uuid];
			return device && device.expires;
		})
		.filter(function(expires){
			if(expires && expires > nowSeconds){
				if(expires < closestToExpire){
					closestToExpire = expires;
				}
				return false; // don't expire in .forEach(...)
			}else{
				return true; // keep to expire
			}
		})
		.forEach(function(expires, uuidIndex, uuidArray){
			var uuid = uuidArray[uuidIndex];
			var device = controlPoint.rootDevices[uuid];
			if(device){
				controlPoint.rootDevices[uuid] = undefined;
				controlPoint.emit('expired', device);
			}
		});

	// set a timeout for another pruning when the next to expire occurs
	if(closestToExpire !== Infinity){
		var timoutTime = (closestToExpire - nowSeconds) * 1000;
		console.log('setting timout for', timoutTime, 'ms from', closestToExpire);
		setTimeout(
			function(){
				controlPoint._pruneExpiredDevices();
			},
			timoutTime
		);
	}


};



exports.uPnpControlPoint = uPnpControlPoint;