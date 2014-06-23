var http = require('http');
var url = require('url');
var os = require('os');

var xml2object = require('xml2object');
var Q = require('q');
//var HTTP = require("q-io/http");
//var EventEmitter = require('events').EventEmitter;

var dataUtils = require('./dataUtils.js');
var uPnpService = require('./uPnpService.js');

module.exports = uPnpDevice;

function uPnpDevice(uuid, advertisment){
	this.uuid = uuid;
	this.advertisment = advertisment;
	this.descriptionLocation = advertisment.headers.location;
	//TODO
}

uPnpDevice.prototype.validTo = function(thenSeconds){
	// if thenSeconds is less than a year, interpret as the number of seconds to live from now
	if(thenSeconds < 60*60*24*7*52){
		thenSeconds += Date.now();
	}

	this.expires = thenSeconds;
};

/**
 * fetchDescription([callback])
 *
 * callback(err [, description])
 **/
uPnpDevice.prototype.fetchDescription = function(callback){
	var self = this,
		descriptionLocation = self.descriptionLocation,
		returnPromise = Q.defer();

	//TODO remove, only for testing (w/o network)
	//location = 'file:///C://Users//nicko_000//Documents//GitHub//arcus-fletching//experiments//dmr.xml';
	//location = 'http://127.0.0.1/test/upnp/dmr.xml';
	//descriptionLocation = self.descriptionLocation = 'http://127.0.0.1/test/upnp/52323/dmr.xml';

	if(!descriptionLocation){
		returnPromise.reject(new Error('No location provided for device description! '+this.uuid));
		return returnPromise.promise;
		//return callback.call(self, new Error('No location provided for device description! '+this.uuid) );
	}


	// parse & store response

	// Create a new xml parser with an array of xml elements to look for
	var parser = new xml2object([ 'root' ]);

	// Bind to the object event to work with the objects found in the XML file
	parser.on('object', function(name, obj) {
		// looking for only 1 object (root) and there should be only 1 in the description
		self.description = dataUtils.formatObjectValues(obj);

		populateServices(self);

		returnPromise.resolve(self.description);
		//callback.call(self, null, self.description);
	});

	// Bind to the file end event to tell when the file is done being streamed
	parser.on('end', function() {
		console.log('Finished parsing xml!');
	});

	// handle bad URLs
	try{
		// pipe an http request into the parser
		// streams decrease memory usage :)
		http.request(descriptionLocation, function(response){
			//console.log('got description response');
			response.pipe(parser.saxStream);
		}).end(); // we don't need to keep the stream open longer than the parser does

	}catch(e){
		console.error('couldnt make request', e);
		//callback.call(self, e);
		returnPromise.reject(e);
	}

	return returnPromise.promise;
};

function populateServices(device){
	//console.log('populateServices serviceList', device.description.device.serviceList);
	device.services = [];

	var baseUrl = device.descriptionLocation;

	if(!device.description.device.serviceList.map){
		device.description.device.serviceList = [device.description.device.serviceList];
	}

	device.description.device.serviceList
		.map(function(xmlServiceDescription){
			//console.log('xmlServiceDescription', xmlServiceDescription);

			// be tolerant of devices not advertising/having these URLs
			var eventUrlPart = xmlServiceDescription.eventSubscriberUrl || xmlServiceDescription.eventSubURL,
				controlUrlPart = xmlServiceDescription.controlUrl || xmlServiceDescription.controlURL,
				scpdUrlPart = xmlServiceDescription.scpdUrl || xmlServiceDescription.SCPDURL;

			return {
				type: xmlServiceDescription.type || xmlServiceDescription.serviceType,
				id : xmlServiceDescription.id || xmlServiceDescription.serviceId,
				controlUrl : controlUrlPart && url.resolve(baseUrl, controlUrlPart),
				eventSubscriberUrl : eventUrlPart && url.resolve(baseUrl, eventUrlPart),
				scpdUrl : scpdUrlPart && url.resolve(baseUrl, scpdUrlPart)
			};
		})
		.forEach(function(opts){
			device.services.push(new uPnpService(opts));
		});

	return device.services;
}

//*
uPnpDevice.prototype.fetchServices = function(callback){
	var self = this;
	if(!self.description){
		return self.fetchDescription().then(function(){
			return self.fetchServices();
		});
	}

	var responsePromises = [];

	self.services.forEach(function(service){
		responsePromises.push(service.fetchActions());
	});

	return Q.all(responsePromises);
};

/**
 * invokeAction(actionName, argObj [, serviceId])
 *
 * invokes the action on the first service it is found on
 **/
uPnpDevice.prototype.invokeAction = function(actionName, argObj, serviceId){
	var d = Q.defer();

	if( ! actionName){
		d.reject(new Error("No action name specified"));
		return d.promise;
	}

	if( ! this.services){
		d.reject(new Error("Must fetch services before invoking actions"));
		return d.promise;
	}

	//TODO find service, invokeAction through service

	try{
	return buildActionSoapRequest();
	}catch(e){
		console.error('error in buildActionSoapRequest', e);
	}


};

